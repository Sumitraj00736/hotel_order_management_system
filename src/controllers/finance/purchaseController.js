const Purchase = require('../../models/finance/Purchase');

const listPurchases = async (req, res) => {
  const filter = req.branchId ? { branchId: req.branchId } : {};
  const { dateFrom, dateTo } = req.query;
  if (dateFrom || dateTo) {
    filter.paidAt = {};
    if (dateFrom) filter.paidAt.$gte = new Date(dateFrom);
    if (dateTo) filter.paidAt.$lte = new Date(dateTo);
  }
  const purchases = await Purchase.find(filter).sort({ paidAt: -1, createdAt: -1 });
  return res.json(purchases);
};

const createPurchase = async (req, res) => {
  const payload = {
    branchId: req.branchId,
    supplierName: req.body.supplierName,
    referenceNo: req.body.referenceNo,
    title: req.body.title,
    amount: Number(req.body.amount || 0),
    paymentMethod: req.body.paymentMethod || 'cash',
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
    note: req.body.note,
    items: Array.isArray(req.body.items) ? req.body.items : [],
    createdBy: req.user?._id
  };
  const purchase = await Purchase.create(payload);
  return res.status(201).json(purchase);
};

const updatePurchase = async (req, res) => {
  const update = {
    supplierName: req.body.supplierName,
    referenceNo: req.body.referenceNo,
    title: req.body.title,
    amount: req.body.amount !== undefined ? Number(req.body.amount || 0) : undefined,
    paymentMethod: req.body.paymentMethod,
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : undefined,
    note: req.body.note,
    items: Array.isArray(req.body.items) ? req.body.items : undefined
  };
  const purchase = await Purchase.findOneAndUpdate(
    { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
    { $set: update },
    { new: true }
  );
  if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
  return res.json(purchase);
};

const deletePurchase = async (req, res) => {
  const purchase = await Purchase.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
  if (!purchase) return res.status(404).json({ message: 'Purchase not found' });
  return res.json({ message: 'Purchase deleted' });
};

module.exports = { listPurchases, createPurchase, updatePurchase, deletePurchase };
