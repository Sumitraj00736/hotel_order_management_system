const SalesReturn = require('../../models/finance/SalesReturn');

const listSalesReturns = async (req, res) => {
  try {
    const filter = req.branchId ? { branchId: req.branchId } : {};
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
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const subTotal = req.body.subTotal !== undefined ? Number(req.body.subTotal || 0) : items.reduce((s, i) => s + Number(i.amount || 0), 0);
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount || 0) : subTotal;
    const netAmount = req.body.netAmount !== undefined ? Number(req.body.netAmount || 0) : totalAmount - Number(req.body.roundOffDiscount || 0);

    const payload = {
      branchId: req.branchId,
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      billReferenceNumber: req.body.billReferenceNumber,
      salesStaff: req.body.salesStaff,
      txnDate: req.body.txnDate ? new Date(req.body.txnDate) : new Date(),
      subTotal,
      roundOffDiscount: Number(req.body.roundOffDiscount || 0),
      taxableAmount: req.body.taxableAmount !== undefined ? Number(req.body.taxableAmount || 0) : totalAmount,
      totalAmount,
      netAmount,
      paymentStatus: req.body.paymentStatus || 'paid',
      paymentMethod: req.body.paymentMethod || 'cash',
      multiplePayment: Boolean(req.body.multiplePayment),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      remarks: req.body.remarks,
      items,
      createdBy: req.user?._id
    };

    const doc = await SalesReturn.create(payload);
    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Create sales return failed', error: error.message });
  }
};

const updateSalesReturn = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : undefined;
    const computedSubTotal = Array.isArray(items) ? items.reduce((s, i) => s + Number(i.amount || 0), 0) : undefined;
    const subTotal = req.body.subTotal !== undefined ? Number(req.body.subTotal || 0) : computedSubTotal;
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount || 0) : subTotal;
    const netAmount = req.body.netAmount !== undefined ? Number(req.body.netAmount || 0) : totalAmount !== undefined ? totalAmount - Number(req.body.roundOffDiscount || 0) : undefined;

    const update = {
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      billReferenceNumber: req.body.billReferenceNumber,
      salesStaff: req.body.salesStaff,
      txnDate: req.body.txnDate ? new Date(req.body.txnDate) : undefined,
      subTotal,
      roundOffDiscount: req.body.roundOffDiscount !== undefined ? Number(req.body.roundOffDiscount || 0) : undefined,
      taxableAmount: req.body.taxableAmount !== undefined ? Number(req.body.taxableAmount || 0) : undefined,
      totalAmount,
      netAmount,
      paymentStatus: req.body.paymentStatus,
      paymentMethod: req.body.paymentMethod,
      multiplePayment: req.body.multiplePayment !== undefined ? Boolean(req.body.multiplePayment) : undefined,
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : undefined,
      remarks: req.body.remarks,
      items
    };

    const doc = await SalesReturn.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      { $set: update },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Sales return not found' });
    return res.json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Update sales return failed', error: error.message });
  }
};

const deleteSalesReturn = async (req, res) => {
  try {
    const doc = await SalesReturn.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
    if (!doc) return res.status(404).json({ message: 'Sales return not found' });
    return res.json({ message: 'Sales return deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete sales return failed', error: error.message });
  }
};

module.exports = { listSalesReturns, createSalesReturn, updateSalesReturn, deleteSalesReturn };

