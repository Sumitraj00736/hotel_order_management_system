const Order = require('../../models/orders/Order');
const Table = require('../../models/tables/Table');
const CustomerHistory = require('../../models/customers/CustomerHistory');
const { emitOrderUpdate, emitTableUpdate } = require('../../utils/realtime/socket');
const { notifyRole, notifyUser } = require('../../utils/notifications/notify');
const { logActivity } = require('../../utils/notifications/activity');
const { nextSequence } = require('../../utils/common/counter');

const generateBill = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) })
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role');

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Only allow waiters to view bills for orders they created
  if (req.user.role === 'waiter' && order.createdBy?._id?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
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
    subTotal: order.subTotal ?? order.totalAmount,
    discountType: order.discountType,
    discountValue: order.discountValue,
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
    taxAmount: order.taxAmount,
    tipsAmount: order.tipsAmount,
    roundOff: order.roundOff,
    taxableAmount: order.taxableAmount ?? order.totalAmount,
    finalAmount: order.finalAmount ?? order.totalAmount,
    totalAmount: order.totalAmount,
    invoiceNo: order.invoiceNo,
    kotNo: order.kotNo,
    paymentStatus: order.paymentStatus,
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
    const {
      paymentMethod,
      paymentStatus = 'paid',
      discountType = 'amount',
      discountValue = 0,
      taxRate = 0,
      tipsAmount = 0,
      roundOff = 0,
      tenderAmount = 0,
      customerName
    } = req.body;
    if (!['cash', 'fonepay', 'card', 'bank'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    const order = await Order.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) })
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Only allow waiters to pay their own orders
    if (req.user.role === 'waiter' && order.createdBy?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (order.status === 'paid') {
      return res.status(400).json({ message: 'Order already paid' });
    }

    const subTotal = order.subTotal ?? order.totalAmount;
    const discountAmt =
      discountType === 'percent'
        ? (subTotal * Number(discountValue || 0)) / 100
        : Number(discountValue || 0);
    const taxableAmount = Math.max(0, subTotal - discountAmt);
    const taxAmount = (taxableAmount * Number(taxRate || 0)) / 100;
    const finalAmount = Math.max(0, taxableAmount + taxAmount + Number(tipsAmount || 0) + Number(roundOff || 0));
    const changeDue = Math.max(0, Number(tenderAmount || 0) - finalAmount);

    const invoiceSeq = await nextSequence(`invoice:${req.branchId}`);
    order.invoiceNo = order.invoiceNo || `INV-${invoiceSeq}`;
    order.status = paymentStatus === 'paid' ? 'paid' : order.status;
    order.paymentStatus = paymentStatus;
    order.paymentMethod = paymentMethod;
    order.paymentRemark = `paid by ${paymentMethod}`;
    order.paidAt = new Date();
    order.paidBy = req.user._id;
    order.subTotal = subTotal;
    order.discountType = discountType;
    order.discountValue = Number(discountValue || 0);
    order.discountAmount = discountAmt;
    order.taxRate = Number(taxRate || 0);
    order.taxAmount = taxAmount;
    order.tipsAmount = Number(tipsAmount || 0);
    order.roundOff = Number(roundOff || 0);
    order.taxableAmount = taxableAmount;
    order.finalAmount = finalAmount;
    order.tenderAmount = Number(tenderAmount || 0);
    order.changeDue = changeDue;
    if (customerName) order.customerName = customerName;
    await order.save();

    if (order.table && order.table._id) {
      const updatedTable = await Table.findOneAndUpdate(
        { _id: order.table._id, ...(req.branchId ? { branchId: req.branchId } : {}) },
        { status: 'available' },
        { new: true }
      );
      if (updatedTable) {
        emitTableUpdate(updatedTable);
      }
    }

    const existingHistory = await CustomerHistory.findOne({ orderId: order._id });
    if (!existingHistory) {
      await CustomerHistory.create({
        branchId: req.branchId,
        orderId: order._id,
        tableNumber: order.table?.tableNumber,
        items: order.items.map((item) => ({
          name: item.menuItem?.name || 'Item',
          quantity: item.quantity,
          priceAtOrderTime: item.priceAtOrderTime
        })),
        totalAmount: order.totalAmount,
        invoiceNo: order.invoiceNo,
        paymentMode: paymentMethod,
        finalAmount,
        discountAmount: discountAmt,
        taxAmount,
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
      category: 'order',
      message: `Payment received for table ${populated.table?.tableNumber} (${paymentMethod})`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:paid',
      category: 'order',
      message: `Order paid for table ${populated.table?.tableNumber} (${paymentMethod})`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: req.branchId
    });
    await logActivity({
      branchId: req.branchId,
      title: 'Order checked out',
      type: 'Order Checkout',
      description: `${req.user?.name || 'Staff'} checked out Table ${populated.table?.tableNumber}`,
      performedBy: req.user?._id
    });

    return res.json({ message: 'Payment recorded', orderId: order._id, status: order.status });
  } catch (error) {
    return res.status(500).json({ message: 'Payment failed', error: error.message });
  }
};

module.exports = { generateBill, payBill };
