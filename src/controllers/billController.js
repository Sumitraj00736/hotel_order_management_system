const Order = require('../models/Order');
const Table = require('../models/Table');
const CustomerHistory = require('../models/CustomerHistory');
const { emitOrderUpdate, emitTableUpdate } = require('../utils/socket');
const { notifyRole, notifyUser } = require('../utils/notify');

const generateBill = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role');

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const bill = {
    orderId: order._id,
    tableNumber: order.table?.tableNumber,
    items: order.items.map((item) => ({
      name: item.menuItem?.name,
      quantity: item.quantity,
      price: item.priceAtOrderTime,
      lineTotal: item.quantity * item.priceAtOrderTime
    })),
    totalAmount: order.totalAmount,
    status: order.status,
    createdAt: order.createdAt,
    waiter: order.createdBy?.name,
    kitchen: order.kitchenAssigned?.name,
    paymentMethod: order.paymentMethod || null,
    paidAt: order.paidAt || null
  };

  return res.json(bill);
};

const payBill = async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    if (!['cash', 'fonepay'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const order = await Order.findById(req.params.id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'paid') {
      return res.status(400).json({ message: 'Order already paid' });
    }

    order.status = 'paid';
    order.paymentMethod = paymentMethod;
    order.paymentRemark = `paid by ${paymentMethod}`;
    order.paidAt = new Date();
    order.paidBy = req.user._id;
    await order.save();

    const updatedTable = await Table.findByIdAndUpdate(order.table._id, { status: 'available' }, { new: true });
    if (updatedTable) {
      emitTableUpdate(updatedTable);
    }

    const existingHistory = await CustomerHistory.findOne({ orderId: order._id });
    if (!existingHistory) {
      await CustomerHistory.create({
        orderId: order._id,
        tableNumber: order.table?.tableNumber,
        items: order.items.map((item) => ({
          name: item.menuItem?.name || 'Item',
          quantity: item.quantity,
          priceAtOrderTime: item.priceAtOrderTime
        })),
        totalAmount: order.totalAmount,
        paymentMethod,
        paidAt: order.paidAt,
        waiter: {
          id: order.createdBy?._id,
          name: order.createdBy?.name
        },
        kitchen: {
          id: order.kitchenAssigned?._id,
          name: order.kitchenAssigned?.name
        },
        orderTakenAt: order.createdAt
      });
    }

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('paidBy', 'name email role');

    emitOrderUpdate(populated);
    await notifyRole({
      role: 'admin',
      type: 'order:paid',
      message: `Payment received for table ${populated.table?.tableNumber} (${paymentMethod})`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:paid',
      message: `Order paid for table ${populated.table?.tableNumber} (${paymentMethod})`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });

    return res.json({ message: 'Payment recorded', orderId: order._id, status: order.status });
  } catch (error) {
    return res.status(500).json({ message: 'Payment failed', error: error.message });
  }
};

module.exports = { generateBill, payBill };
