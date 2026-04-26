const PurchaseReturn = require('../../models/finance/PurchaseReturn');
const { computeSimpleTotals } = require('../../utils/finance/calculations');

const buildPurchaseReturnPayload = (body, req) => {
  const totals = computeSimpleTotals({
    items: Array.isArray(body.items) ? body.items : [],
    discountType: 'amount',
    discountValue: body.discount || 0,
    taxRate: body.taxRate || 0,
    roundOff: body.roundOff || 0,
    quantityKeys: ['qty', 'quantity'],
    rateKeys: ['rate', 'unitPrice'],
    amountKeys: ['amount', 'total']
  });

  return {
    branchId: req.branchId,
    supplierId: body.supplierId,
    supplierName: body.supplierName,
    billDate: body.billDate ? new Date(body.billDate) : new Date(),
    billReferenceNumber: body.billReferenceNumber,
    purchaseStaff: body.purchaseStaff,
    subTotal: totals.subTotal,
    discount: totals.discountAmount,
    taxableAmount: totals.taxableAmount,
    totalAmount: totals.grandTotal,
    paymentStatus: body.paymentStatus || 'paid',
    paymentMethod: body.paymentMethod || 'cash',
    multiplePayment: Boolean(body.multiplePayment),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    remarks: body.remarks,
    items: totals.items.map((item) => ({
      ...item,
      qty: item.qty,
      amount: item.amount
    })),
    createdBy: body.createdBy || req.user?._id
  };
};

const listPurchaseReturns = async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.branchId) filter.branchId = req.branchId;
    const { dateFrom, dateTo } = req.query;
    if (dateFrom || dateTo) {
      filter.billDate = {};
      if (dateFrom) filter.billDate.$gte = new Date(dateFrom);
      if (dateTo) filter.billDate.$lte = new Date(dateTo);
    }
    const rows = await PurchaseReturn.find(filter).sort({ billDate: -1, createdAt: -1 });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'List purchase returns failed', error: error.message });
  }
};

const createPurchaseReturn = async (req, res) => {
  try {
    const doc = await PurchaseReturn.create(buildPurchaseReturnPayload(req.body, req));
    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Create purchase return failed', error: error.message });
  }
};

const updatePurchaseReturn = async (req, res) => {
  try {
    const existing = await PurchaseReturn.findOne({
      _id: req.params.id,
      status: 'active',
      ...(req.branchId ? { branchId: req.branchId } : {})
    });
    if (!existing) return res.status(404).json({ message: 'Purchase return not found' });

    const doc = await PurchaseReturn.findOneAndUpdate(
      { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
      { $set: buildPurchaseReturnPayload({ ...existing.toObject(), ...req.body }, req) },
      { new: true }
    );
    return res.json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Update purchase return failed', error: error.message });
  }
};

const deletePurchaseReturn = async (req, res) => {
  try {
    const doc = await PurchaseReturn.findOneAndUpdate(
      { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
      {
        $set: {
          status: 'void',
          voidReason: req.body.reason || 'Voided via UI',
          voidedAt: new Date(),
          voidedBy: req.user?._id
        }
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Purchase return not found' });
    return res.json({ message: 'Purchase return successfully voided' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete purchase return failed', error: error.message });
  }
};

module.exports = { listPurchaseReturns, createPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn };
