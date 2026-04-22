const Purchase = require('../../models/finance/Purchase');
const Ingredient = require('../../models/inventory/Ingredient');
const StockTransaction = require('../../models/inventory/StockTransaction');

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
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const computedAmount =
    req.body.amount !== undefined
      ? Number(req.body.amount || 0)
      : items.reduce((sum, row) => sum + Number(row.amount ?? row.total ?? 0), 0);
  const payload = {
    branchId: req.branchId,
    supplierId: req.body.supplierId || undefined,
    supplierName: req.body.supplierName,
    referenceNo: req.body.referenceNo,
    title: req.body.title,
    billDate: req.body.billDate ? new Date(req.body.billDate) : undefined,
    billReferenceNumber: req.body.billReferenceNumber,
    purchaseStaff: req.body.purchaseStaff,
    amount: computedAmount,
    paymentStatus: req.body.paymentStatus || 'paid',
    paymentMethod: req.body.paymentMethod || 'cash',
    multiplePayment: Boolean(req.body.multiplePayment),
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
    note: req.body.note,
    items,
    attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    createdBy: req.user?._id
  };
  const purchase = await Purchase.create(payload);

  // Auto-restock linked ingredients
  const restockOps = items.filter(i => i.ingredientId && Number(i.qty || i.quantity || 0) > 0);
  if (restockOps.length > 0) {
    await Promise.all(restockOps.map(async (row) => {
      const qty = Number(row.qty || row.quantity || 0);
      const rate = Number(row.rate || row.unitPrice || 0);
      try {
        const ingredient = await Ingredient.findOneAndUpdate(
          { _id: row.ingredientId, ...(req.branchId ? { branchId: req.branchId } : {}) },
          { $inc: { currentStock: qty }, lastRestockedAt: new Date() },
          { new: true }
        );
        if (ingredient) {
          await StockTransaction.create({
            branchId: req.branchId,
            ingredient: ingredient._id,
            delta: qty,
            reason: 'restock',
            referencePurchase: purchase._id,
            unitCost: rate,
            totalCost: Math.round(qty * rate * 100) / 100,
            note: `Purchase Bill: ${purchase.billReferenceNumber || purchase._id.toString().slice(-6)}`,
            createdBy: req.user?._id
          });
        }
      } catch (_) { /* skip failed ingredient update silently */ }
    }));
  }

  return res.status(201).json(purchase);
};

const updatePurchase = async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : undefined;
  const computedAmount =
    req.body.amount !== undefined
      ? Number(req.body.amount || 0)
      : Array.isArray(items)
        ? items.reduce((sum, row) => sum + Number(row.amount ?? row.total ?? 0), 0)
        : undefined;
  const update = {
    supplierName: req.body.supplierName,
    referenceNo: req.body.referenceNo,
    title: req.body.title,
    billDate: req.body.billDate ? new Date(req.body.billDate) : undefined,
    billReferenceNumber: req.body.billReferenceNumber,
    purchaseStaff: req.body.purchaseStaff,
    amount: computedAmount,
    paymentStatus: req.body.paymentStatus,
    paymentMethod: req.body.paymentMethod,
    multiplePayment: req.body.multiplePayment !== undefined ? Boolean(req.body.multiplePayment) : undefined,
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : undefined,
    note: req.body.note,
    items,
    attachments: Array.isArray(req.body.attachments) ? req.body.attachments : undefined
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
