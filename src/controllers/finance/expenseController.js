const mongoose = require('mongoose');
const Expense = require('../../models/finance/Expense');
const MathUtils = require('../../utils/mathUtils');

const listExpenses = async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.branchId) filter.branchId = req.branchId;
    const { dateFrom, dateTo } = req.query;
    if (dateFrom || dateTo) {
      filter.paidAt = {};
      if (dateFrom) filter.paidAt.$gte = new Date(dateFrom);
      if (dateTo) filter.paidAt.$lte = new Date(dateTo);
    }
    const expenses = await Expense.find(filter).sort({ paidAt: -1, createdAt: -1 });
    return res.json(expenses);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list expenses', error: error.message });
  }
};

const createExpense = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let expense;
    await session.withTransaction(async () => {
      const payload = {
        branchId: req.branchId,
        title: req.body.title,
        category: req.body.category,
        amount: MathUtils.roundAmount(req.body.amount),
        accountHead: req.body.accountHead,
        partyType: req.body.partyType,
        partyId: req.body.partyId,
        partyName: req.body.partyName,
        paymentStatus: req.body.paymentStatus || 'paid',
        paymentMethod: req.body.paymentMethod || 'cash',
        multiplePayment: Boolean(req.body.multiplePayment),
        referenceNo: req.body.referenceNo,
        paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
        note: req.body.note,
        attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
        createdBy: req.user?._id
      };
      const [newExpense] = await Expense.create([payload], { session });
      expense = newExpense;
    });
    return res.status(201).json(expense);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create expense', error: error.message });
  } finally {
    session.endSession();
  }
};

const updateExpense = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let expense;
    await session.withTransaction(async () => {
      const update = {
        title: req.body.title,
        category: req.body.category,
        amount: req.body.amount !== undefined ? MathUtils.roundAmount(req.body.amount) : undefined,
        accountHead: req.body.accountHead,
        partyType: req.body.partyType,
        partyId: req.body.partyId,
        partyName: req.body.partyName,
        paymentStatus: req.body.paymentStatus,
        paymentMethod: req.body.paymentMethod,
        multiplePayment: req.body.multiplePayment !== undefined ? Boolean(req.body.multiplePayment) : undefined,
        referenceNo: req.body.referenceNo,
        paidAt: req.body.paidAt ? new Date(req.body.paidAt) : undefined,
        note: req.body.note,
        attachments: Array.isArray(req.body.attachments) ? req.body.attachments : undefined
      };

      Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);

      expense = await Expense.findOneAndUpdate(
        { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
        { $set: update },
        { new: true, session }
      );
      if (!expense) throw new Error('Expense not found or already voided');
    });
    return res.json(expense);
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

const deleteExpense = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const expense = await Expense.findOneAndUpdate(
        { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
        { 
          $set: { 
            status: 'void', 
            voidReason: req.body.reason || 'Deleted via UI',
            voidedAt: new Date(),
            voidedBy: req.user?._id
          }
        },
        { new: true, session }
      );
      
      if (!expense) throw new Error('Expense not found or already voided');
    });
    return res.json({ message: 'Expense successfully voided' });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

module.exports = { listExpenses, createExpense, updateExpense, deleteExpense };
