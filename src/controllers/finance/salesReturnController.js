const SalesReturn = require('../../models/finance/SalesReturn');
const { computeSimpleTotals, sanitizeAmount } = require('../../utils/finance/calculations');

const buildSalesReturnPayload = (body, req) => {
  const totals = computeSimpleTotals({
    items: Array.isArray(body.items) ? body.items : [],
    discountType: 'amount',
    discountValue: body.roundOffDiscount || 0,
    taxRate: 0,
    roundOff: 0,
    quantityKeys: ['returnQty', 'qty', 'quantity'],
    rateKeys: ['rate'],
    amountKeys: ['amount']
  });

  return {
    branchId: req.branchId,
    customerId: body.customerId,
    customerName: body.customerName,
    billReferenceNumber: body.billReferenceNumber,
    salesStaff: body.salesStaff,
    txnDate: body.txnDate ? new Date(body.txnDate) : new Date(),
    subTotal: totals.subTotal,
    roundOffDiscount: totals.discountAmount,
    taxableAmount: totals.taxableAmount,
    totalAmount: totals.subTotal,
    netAmount: sanitizeAmount(Math.max(0, totals.subTotal - totals.discountAmount)),
    paymentStatus: body.paymentStatus || 'paid',
    paymentMethod: body.paymentMethod || 'cash',
    multiplePayment: Boolean(body.multiplePayment),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    remarks: body.remarks,
    items: totals.items.map((item) => ({
      ...item,
      returnQty: item.returnQty,
      amount: item.amount
    })),
    createdBy: body.createdBy || req.user?._id
  };
};

const listSalesReturns = async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.branchId) filter.branchId = req.branchId;
    const { dateFrom, dateTo } = req.query;
    if (dateFrom || dateTo) {
      filter.txnDate = {};
      if (dateFrom) filter.txnDate.$gte = new Date(dateFrom);
      if (dateTo) filter.txnDate.$lte = new Date(dateTo);
    }
    const rows = await SalesReturn.find(filter).sort({ txnDate: -1, createdAt: -1 });
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'List sales returns failed', error: error.message });
  }
};

const createSalesReturn = async (req, res) => {
  try {
    const doc = await SalesReturn.create(buildSalesReturnPayload(req.body, req));
    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Create sales return failed', error: error.message });
  }
};

const updateSalesReturn = async (req, res) => {
  try {
    const existing = await SalesReturn.findOne({
      _id: req.params.id,
      status: 'active',
      ...(req.branchId ? { branchId: req.branchId } : {})
    });
    if (!existing) return res.status(404).json({ message: 'Sales return not found' });

    const doc = await SalesReturn.findOneAndUpdate(
      { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
      { $set: buildSalesReturnPayload({ ...existing.toObject(), ...req.body }, req) },
      { new: true }
    );
    return res.json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Update sales return failed', error: error.message });
  }
};

const deleteSalesReturn = async (req, res) => {
  try {
    const doc = await SalesReturn.findOneAndUpdate(
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
    if (!doc) return res.status(404).json({ message: 'Sales return not found' });
    return res.json({ message: 'Sales return successfully voided' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete sales return failed', error: error.message });
  }
};

module.exports = { listSalesReturns, createSalesReturn, updateSalesReturn, deleteSalesReturn };
