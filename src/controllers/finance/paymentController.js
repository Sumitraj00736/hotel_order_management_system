const Payment = require('../../models/finance/Payment');

const listPayments = async (req, res) => {
  try {
    const filter = req.branchId ? { branchId: req.branchId } : {};
    const { dateFrom, dateTo, direction } = req.query;
    if (direction) filter.direction = String(direction).toLowerCase();
    if (dateFrom || dateTo) {
      filter.txnDate = {};
      if (dateFrom) filter.txnDate.$gte = new Date(dateFrom);
      if (dateTo) filter.txnDate.$lte = new Date(dateTo);
    }
    const rows = await Payment.find(filter).sort({ txnDate: -1, createdAt: -1 });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'List payments failed', error: error.message });
  }
};

const createPayment = async (req, res) => {
  try {
    const payload = {
      branchId: req.branchId,
      direction: req.body.direction,
      amount: Number(req.body.amount || 0),
      accountHead: req.body.accountHead,
      partyType: req.body.partyType,
      partyId: req.body.partyId,
      partyName: req.body.partyName,
      paymentStatus: req.body.paymentStatus || 'paid',
      paymentMethod: req.body.paymentMethod || 'cash',
      multiplePayment: Boolean(req.body.multiplePayment),
      referenceNo: req.body.referenceNo,
      txnDate: req.body.txnDate ? new Date(req.body.txnDate) : new Date(),
      remarks: req.body.remarks,
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      createdBy: req.user?._id
    };
    const doc = await Payment.create(payload);
    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Create payment failed', error: error.message });
  }
};

const updatePayment = async (req, res) => {
  try {
    const update = {
      direction: req.body.direction,
      amount: req.body.amount !== undefined ? Number(req.body.amount || 0) : undefined,
      accountHead: req.body.accountHead,
      partyType: req.body.partyType,
      partyId: req.body.partyId,
      partyName: req.body.partyName,
      paymentStatus: req.body.paymentStatus,
      paymentMethod: req.body.paymentMethod,
      multiplePayment: req.body.multiplePayment !== undefined ? Boolean(req.body.multiplePayment) : undefined,
      referenceNo: req.body.referenceNo,
      txnDate: req.body.txnDate ? new Date(req.body.txnDate) : undefined,
      remarks: req.body.remarks,
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : undefined
    };
    const doc = await Payment.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      { $set: update },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Payment not found' });
    return res.json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Update payment failed', error: error.message });
  }
};

const deletePayment = async (req, res) => {
  try {
    const doc = await Payment.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
    if (!doc) return res.status(404).json({ message: 'Payment not found' });
    return res.json({ message: 'Payment deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete payment failed', error: error.message });
  }
};

module.exports = { listPayments, createPayment, updatePayment, deletePayment };

