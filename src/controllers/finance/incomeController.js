const mongoose = require('mongoose');
const Income = require('../../models/finance/Income');
const MathUtils = require('../../utils/mathUtils');

const listIncomes = async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.branchId) filter.branchId = req.branchId;
    const { dateFrom, dateTo } = req.query;
    if (dateFrom || dateTo) {
      filter.txnDate = {};
      if (dateFrom) filter.txnDate.$gte = new Date(dateFrom);
      if (dateTo) filter.txnDate.$lte = new Date(dateTo);
    }
    const incomes = await Income.find(filter).sort({ txnDate: -1, createdAt: -1 });
    return res.json(incomes);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list incomes', error: error.message });
  }
};

const createIncome = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let income;
    await session.withTransaction(async () => {
      const payload = {
        branchId: req.branchId,
        amount: MathUtils.roundAmount(req.body.amount),
        remarks: req.body.remarks,
        accountHead: req.body.accountHead,
        partyType: req.body.partyType,
        partyId: req.body.partyId,
        partyName: req.body.partyName,
        paymentStatus: req.body.paymentStatus || 'paid',
        paymentMethod: req.body.paymentMethod || 'cash',
        multiplePayment: Boolean(req.body.multiplePayment),
        referenceNo: req.body.referenceNo,
        txnDate: req.body.txnDate ? new Date(req.body.txnDate) : new Date(),
        attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
        createdBy: req.user?._id
      };
      
      const [newIncome] = await Income.create([payload], { session });
      income = newIncome;
    });
    return res.status(201).json(income);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create income', error: error.message });
  } finally {
    session.endSession();
  }
};

const updateIncome = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let income;
    await session.withTransaction(async () => {
      const update = {
        amount: req.body.amount !== undefined ? MathUtils.roundAmount(req.body.amount) : undefined,
        remarks: req.body.remarks,
        accountHead: req.body.accountHead,
        partyType: req.body.partyType,
        partyId: req.body.partyId,
        partyName: req.body.partyName,
        paymentStatus: req.body.paymentStatus,
        paymentMethod: req.body.paymentMethod,
        multiplePayment: req.body.multiplePayment !== undefined ? Boolean(req.body.multiplePayment) : undefined,
        referenceNo: req.body.referenceNo,
        txnDate: req.body.txnDate ? new Date(req.body.txnDate) : undefined,
        attachments: Array.isArray(req.body.attachments) ? req.body.attachments : undefined
      };
      
      // Clean undefined
      Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);

      income = await Income.findOneAndUpdate(
        { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
        { $set: update },
        { new: true, session }
      );
      
      if (!income) throw new Error('Income not found or already voided');
    });
    return res.json(income);
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

const deleteIncome = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const income = await Income.findOneAndUpdate(
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
      
      if (!income) throw new Error('Income not found or already voided');
    });
    return res.json({ message: 'Income successfully voided' });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

module.exports = { listIncomes, createIncome, updateIncome, deleteIncome };

