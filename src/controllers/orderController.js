const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Table = require('../models/Table');
const { emitNewOrder, emitOrderUpdate } = require('../utils/socket');
const { notifyRole, notifyUser } = require('../utils/notify');

const buildOrderItems = async (items) => {
  const menuIds = items.map((item) => item.menuItem);
  const menuItems = await MenuItem.find({ _id: { $in: menuIds }, isAvailable: true });
  if (menuItems.length !== menuIds.length) {
    throw new Error('One or more menu items are unavailable');
  }

  const menuMap = new Map(menuItems.map((item) => [item._id.toString(), item]));
  const orderItems = items.map((item) => {
    const menu = menuMap.get(item.menuItem);
    return {
      menuItem: menu._id,
      quantity: item.quantity,
      priceAtOrderTime: menu.price
    };
  });

  const totalAmount = orderItems.reduce((sum, item) => sum + item.quantity * item.priceAtOrderTime, 0);
  return { orderItems, totalAmount };
};

const listOrders = async (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.user.role === 'waiter') {
    filter.createdBy = req.user._id;
  }

  const orders = await Order.find(filter)
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role')
    .populate('paidBy', 'name email role')
    .sort({ createdAt: -1 });

  return res.json(orders);
};

const getOrder = async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('table')
    .populate('items.menuItem')
    .populate('createdBy', 'name email role')
    .populate('kitchenAssigned', 'name email role')
    .populate('paidBy', 'name email role');

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  if (req.user.role === 'waiter' && order.createdBy._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  return res.json(order);
};

const createOrder = async (req, res) => {
  try {
    const { table, items } = req.body;
    const tableDoc = await Table.findById(table);
    if (!tableDoc) {
      return res.status(404).json({ message: 'Table not found' });
    }

    const { orderItems, totalAmount } = await buildOrderItems(items);
    const order = await Order.create({
      table,
      items: orderItems,
      totalAmount,
      status: 'pending',
      createdBy: req.user._id
    });

    tableDoc.status = 'occupied';
    await tableDoc.save();

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('paidBy', 'name email role');

    emitNewOrder(populated);
    await notifyRole({
      role: 'kitchen',
      type: 'order:new',
      message: `New order for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyRole({
      role: 'admin',
      type: 'order:new',
      message: `${populated.createdBy?.name || 'Waiter'} booked table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:new',
      message: `You placed an order for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    return res.status(201).json(populated);
  } catch (error) {
    return res.status(400).json({ message: 'Create order failed', error: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status === 'paid') {
      return res.status(400).json({ message: 'Paid orders cannot be edited' });
    }

    if (req.user.role === 'waiter' && order.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const changes = [];
    if (req.body.table) {
      order.table = req.body.table;
      changes.push('table updated');
    }

    if (req.body.items) {
      const { orderItems, totalAmount } = await buildOrderItems(req.body.items);
      order.items = orderItems;
      order.totalAmount = totalAmount;
      changes.push('items updated');
    }

    if (req.body.status && req.user.role !== 'waiter') {
      if (req.body.status === 'paid') {
        return res.status(400).json({ message: 'Use billing to mark orders as paid' });
      }
      order.status = req.body.status;
      changes.push(`status -> ${req.body.status}`);
    }

    if (changes.length > 0) {
      order.editLogs.push({ editedBy: req.user._id, changes: changes.join(', ') });
    }

    await order.save();

    if (order.status === 'paid') {
      await Table.findByIdAndUpdate(order.table, { status: 'available' });
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
      type: 'order:update',
      message: `Order updated for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:update',
      message: `Order updated for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    return res.json(populated);
  } catch (error) {
    return res.status(400).json({ message: 'Update order failed', error: error.message });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (req.user.role === 'kitchen' && !order.kitchenAssigned) {
      order.kitchenAssigned = req.user._id;
      order.kitchenAssignedAt = new Date();
    }

    if (req.body.status === 'paid') {
      return res.status(400).json({ message: 'Use billing to mark orders as paid' });
    }

    order.status = req.body.status;
    order.editLogs.push({ editedBy: req.user._id, changes: `status -> ${req.body.status}` });
    await order.save();

    if (order.status === 'paid') {
      await Table.findByIdAndUpdate(order.table, { status: 'available' });
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
      type: 'order:status',
      message: `Kitchen set table ${populated.table?.tableNumber} to ${populated.status}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    await notifyUser({
      role: 'waiter',
      userId: populated.createdBy?._id,
      type: 'order:status',
      message: `Kitchen set table ${populated.table?.tableNumber} to ${populated.status}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber
    });
    return res.json(populated);
  } catch (error) {
    return res.status(400).json({ message: 'Update status failed', error: error.message });
  }
};

module.exports = { listOrders, getOrder, createOrder, updateOrder, updateOrderStatus };
