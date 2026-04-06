const Expense = require('../models/Expense');

const listExpenses = async (req, res) => {
  const filter = req.branchId ? { branchId: req.branchId } : {};
  const { dateFrom, dateTo } = req.query;
  if (dateFrom || dateTo) {
    filter.paidAt = {};
    if (dateFrom) filter.paidAt.$gte = new Date(dateFrom);
    if (dateTo) filter.paidAt.$lte = new Date(dateTo);
  }
  const expenses = await Expense.find(filter).sort({ paidAt: -1, createdAt: -1 });
  return res.json(expenses);
};

const createExpense = async (req, res) => {
  const payload = {
    branchId: req.branchId,
    title: req.body.title,
    category: req.body.category,
    amount: Number(req.body.amount || 0),
    paymentMethod: req.body.paymentMethod || 'cash',
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
    note: req.body.note,
    createdBy: req.user?._id
  };
  const expense = await Expense.create(payload);
  return res.status(201).json(expense);
};

const updateExpense = async (req, res) => {
  const update = {
    title: req.body.title,
    category: req.body.category,
    amount: req.body.amount !== undefined ? Number(req.body.amount || 0) : undefined,
    paymentMethod: req.body.paymentMethod,
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : undefined,
    note: req.body.note
  };
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
    { $set: update },
    { new: true }
  );
  if (!expense) return res.status(404).json({ message: 'Expense not found' });
  return res.json(expense);
};

const deleteExpense = async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!expense) return res.status(404).json({ message: 'Expense not found' });
  return res.json({ message: 'Expense deleted' });
};

module.exports = { listExpenses, createExpense, updateExpense, deleteExpense };
