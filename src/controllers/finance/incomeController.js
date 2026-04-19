const Income = require('../../models/finance/Income');

const listIncomes = async (req, res) => {
  const filter = req.branchId ? { branchId: req.branchId } : {};
  const { dateFrom, dateTo } = req.query;
  if (dateFrom || dateTo) {
    filter.txnDate = {};
    if (dateFrom) filter.txnDate.$gte = new Date(dateFrom);
    if (dateTo) filter.txnDate.$lte = new Date(dateTo);
  }
  const incomes = await Income.find(filter).sort({ txnDate: -1, createdAt: -1 });
  return res.json(incomes);
};

const createIncome = async (req, res) => {
  const payload = {
    branchId: req.branchId,
    amount: Number(req.body.amount || 0),
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
  const income = await Income.create(payload);
  return res.status(201).json(income);
};

const updateIncome = async (req, res) => {
  const update = {
    amount: req.body.amount !== undefined ? Number(req.body.amount || 0) : undefined,
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
  const income = await Income.findOneAndUpdate(
    { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
    { $set: update },
    { new: true }
  );
  if (!income) return res.status(404).json({ message: 'Income not found' });
  return res.json(income);
};

const deleteIncome = async (req, res) => {
  const income = await Income.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!income) return res.status(404).json({ message: 'Income not found' });
  return res.json({ message: 'Income deleted' });
};

module.exports = { listIncomes, createIncome, updateIncome, deleteIncome };

