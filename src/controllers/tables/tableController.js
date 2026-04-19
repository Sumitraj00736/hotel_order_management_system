const Table = require('../../models/tables/Table');
const Order = require('../../models/orders/Order');
const { emitTableUpdate } = require('../../utils/realtime/socket');
const { notifyRole } = require('../../utils/notifications/notify');

const listTables = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  if (req.query.includeTrashed !== 'true') {
    filter.isTrashed = { $ne: true };
  }
  const tables = await Table.find(filter)
    .populate('spaceId', 'name type')
    .populate('tableTypeId', 'name active')
    .sort({ row: 1, column: 1, tableNumber: 1 });
  return res.json(tables);
};

const getTable = async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  return res.json(table);
};

const createTable = async (req, res) => {
  try {
    const payload = { ...req.body, branchId: req.branchId };
    if (!payload.name && payload.tableNumber) {
      payload.name = `${payload.type === 'cabin' ? 'Cabin' : 'Table'} ${payload.tableNumber}`;
    }
    const table = await Table.create(payload);
    return res.status(201).json(table);
  } catch (error) {
    return res.status(500).json({ message: 'Create table failed', error: error.message });
  }
};

const updateTable = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.tableNumber && !update.name) {
      update.name = `${update.type === 'cabin' ? 'Cabin' : 'Table'} ${update.tableNumber}`;
    }
    const table = await Table.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      update,
      { new: true }
    );
    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }
    return res.json(table);
  } catch (error) {
    return res.status(500).json({ message: 'Update table failed', error: error.message });
  }
};

const deleteTable = async (req, res) => {
  // Soft-delete for RestroX-style "Move to trash"
  const table = await Table.findOneAndUpdate(
    { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
    { $set: { isTrashed: true } },
    { new: true }
  );
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  return res.json({ message: 'Table moved to trash', table });
};

const freeTable = async (req, res) => {
  const table = await Table.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }

  // Prevent freeing a table that still has active orders
  const activeOrder = await Order.findOne({ table: table._id, status: { $ne: 'paid' }, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (activeOrder) {
    return res.status(400).json({ message: 'Cannot free table with active orders' });
  }

  table.status = 'available';
  await table.save();
  emitTableUpdate(table);
  await notifyRole({
    role: 'admin',
    type: 'table:free',
    message: `Table ${table.tableNumber} set to available`,
    tableNumber: table.tableNumber,
    branchId: req.branchId
  });
  await notifyRole({
    role: 'waiter',
    type: 'table:free',
    message: `Table ${table.tableNumber} set to available`,
    tableNumber: table.tableNumber,
    branchId: req.branchId
  });
  return res.json({ message: 'Table set to available', table });
};

module.exports = { listTables, getTable, createTable, updateTable, deleteTable, freeTable };
