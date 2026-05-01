const Table = require('../../models/tables/Table');
const { emitNewOrder, emitTableUpdate } = require('../../utils/realtime/socket');
const { notifyRole } = require('../../utils/notifications/notify');
const { buildOrderItems, ensureInventoryAvailability, consumeInventory } = require('./orderController');
const Order = require('../../models/orders/Order');
const mongoose = require('mongoose');

// Simple guest session helper
const makeSessionId = () => Math.random().toString(36).slice(2, 10);

const createGuestOrder = async (req, res) => {
  let session;
  try {
    const { table, items, guestName, spiceLevel, specialInstructions } = req.body;
    session = await mongoose.startSession();
    session.startTransaction();

    const tableDoc = await Table.findOne({ _id: table, branchId: req.branchId }).session(session);
    if (!tableDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Table not found for this branch' });
    }
    if (tableDoc.status === 'occupied') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Table already occupied' });
    }

    const { orderItems, totalAmount } = await buildOrderItems(items, tableDoc.branchId);
    await ensureInventoryAvailability(orderItems, session);

    const [order] = await Order.create([{
      table,
      items: orderItems,
      totalAmount,
      status: 'pending',
      source: 'guest',
      branchId: tableDoc.branchId,
      guestName,
      guestSession: makeSessionId(),
      spiceLevel: spiceLevel || 'medium',
      specialInstructions
    }], { session });

    tableDoc.status = 'occupied';
    await tableDoc.save({ session });

    await consumeInventory(orderItems, order._id, null, session);

    await session.commitTransaction();
    session.endSession();
    emitTableUpdate(tableDoc);

    const populated = await Order.findById(order._id)
      .populate('table')
      .populate('items.menuItem');

    emitNewOrder(populated);
    await notifyRole({
      role: 'kitchen',
      type: 'order:new',
      category: 'order',
      message: `Guest order for table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: tableDoc.branchId
    });
    await notifyRole({
      role: 'admin',
      type: 'order:new',
      category: 'order',
      message: `Guest booked table ${populated.table?.tableNumber}`,
      orderId: populated._id,
      tableNumber: populated.table?.tableNumber,
      branchId: tableDoc.branchId
    });

    return res.status(201).json(populated);
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
        session.endSession();
      } catch (_) {
        /* ignore abort errors */
      }
    }
    return res.status(400).json({ message: 'Create guest order failed', error: error.message });
  }
};

const guestStatus = async (req, res) => {
  const tableId = req.params.tableId;
  const table = await Table.findOne({ _id: tableId, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!table) return res.status(404).json({ message: 'Table not found' });

  const activeOrders = await Order.find({ table: tableId, status: { $in: ['pending', 'preparing', 'ready', 'served'] } })
    .populate('items.menuItem')
    .sort({ createdAt: -1 });

  return res.json({ table, activeOrders });
};

module.exports = { createGuestOrder, guestStatus };
