const Table = require('../models/Table');
const Order = require('../models/Order');
const { emitTableUpdate } = require('../utils/socket');
const { notifyRole } = require('../utils/notify');

const listTables = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  const tables = await Table.find(filter).sort({ row: 1, column: 1, tableNumber: 1 });
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
    const table = await Table.create(payload);
    return res.status(201).json(table);
  } catch (error) {
    return res.status(500).json({ message: 'Create table failed', error: error.message });
  }
};

const updateTable = async (req, res) => {
  try {
    const table = await Table.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      req.body,
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
  const table = await Table.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  return res.json({ message: 'Table deleted' });
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
