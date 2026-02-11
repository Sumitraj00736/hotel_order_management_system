const Table = require('../models/Table');
const { emitTableUpdate } = require('../utils/socket');
const { notifyRole } = require('../utils/notify');

const listTables = async (req, res) => {
  const tables = await Table.find().sort({ tableNumber: 1 });
  return res.json(tables);
};

const getTable = async (req, res) => {
  const table = await Table.findById(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  return res.json(table);
};

const createTable = async (req, res) => {
  try {
    const table = await Table.create(req.body);
    return res.status(201).json(table);
  } catch (error) {
    return res.status(500).json({ message: 'Create table failed', error: error.message });
  }
};

const updateTable = async (req, res) => {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!table) {
      return res.status(404).json({ message: 'Table not found' });
    }
    return res.json(table);
  } catch (error) {
    return res.status(500).json({ message: 'Update table failed', error: error.message });
  }
};

const deleteTable = async (req, res) => {
  const table = await Table.findByIdAndDelete(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  return res.json({ message: 'Table deleted' });
};

const freeTable = async (req, res) => {
  const table = await Table.findById(req.params.id);
  if (!table) {
    return res.status(404).json({ message: 'Table not found' });
  }
  table.status = 'available';
  await table.save();
  emitTableUpdate(table);
  await notifyRole({
    role: 'admin',
    type: 'table:free',
    message: `Table ${table.tableNumber} set to available`,
    tableNumber: table.tableNumber
  });
  await notifyRole({
    role: 'waiter',
    type: 'table:free',
    message: `Table ${table.tableNumber} set to available`,
    tableNumber: table.tableNumber
  });
  return res.json({ message: 'Table set to available', table });
};

module.exports = { listTables, getTable, createTable, updateTable, deleteTable, freeTable };
