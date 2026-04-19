const PurchaseReturn = require('../../models/finance/PurchaseReturn');

const listPurchaseReturns = async (req, res) => {
  try {
    const filter = req.branchId ? { branchId: req.branchId } : {};
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
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const subTotal =
      req.body.subTotal !== undefined
        ? Number(req.body.subTotal || 0)
        : items.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount || 0) : subTotal;
    const payload = {
      branchId: req.branchId,
      supplierId: req.body.supplierId,
      supplierName: req.body.supplierName,
      billDate: req.body.billDate ? new Date(req.body.billDate) : new Date(),
      billReferenceNumber: req.body.billReferenceNumber,
      purchaseStaff: req.body.purchaseStaff,
      subTotal,
      discount: Number(req.body.discount || 0),
      taxableAmount: req.body.taxableAmount !== undefined ? Number(req.body.taxableAmount || 0) : totalAmount,
      totalAmount,
      paymentStatus: req.body.paymentStatus || 'paid',
      paymentMethod: req.body.paymentMethod || 'cash',
      multiplePayment: Boolean(req.body.multiplePayment),
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      remarks: req.body.remarks,
      items,
      createdBy: req.user?._id
    };
    const doc = await PurchaseReturn.create(payload);
    return res.status(201).json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Create purchase return failed', error: error.message });
  }
};

const updatePurchaseReturn = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : undefined;
    const computedSubTotal = Array.isArray(items) ? items.reduce((sum, row) => sum + Number(row.amount || 0), 0) : undefined;
    const subTotal = req.body.subTotal !== undefined ? Number(req.body.subTotal || 0) : computedSubTotal;
    const totalAmount = req.body.totalAmount !== undefined ? Number(req.body.totalAmount || 0) : subTotal;

    const update = {
      supplierId: req.body.supplierId,
      supplierName: req.body.supplierName,
      billDate: req.body.billDate ? new Date(req.body.billDate) : undefined,
      billReferenceNumber: req.body.billReferenceNumber,
      purchaseStaff: req.body.purchaseStaff,
      subTotal,
      discount: req.body.discount !== undefined ? Number(req.body.discount || 0) : undefined,
      taxableAmount: req.body.taxableAmount !== undefined ? Number(req.body.taxableAmount || 0) : undefined,
      totalAmount,
      paymentStatus: req.body.paymentStatus,
      paymentMethod: req.body.paymentMethod,
      multiplePayment: req.body.multiplePayment !== undefined ? Boolean(req.body.multiplePayment) : undefined,
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : undefined,
      remarks: req.body.remarks,
      items
    };
    const doc = await PurchaseReturn.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      { $set: update },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Purchase return not found' });
    return res.json(doc);
  } catch (error) {
    return res.status(500).json({ message: 'Update purchase return failed', error: error.message });
  }
};

const deletePurchaseReturn = async (req, res) => {
  try {
    const doc = await PurchaseReturn.findOneAndDelete({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
    if (!doc) return res.status(404).json({ message: 'Purchase return not found' });
    return res.json({ message: 'Purchase return deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Delete purchase return failed', error: error.message });
  }
};

module.exports = { listPurchaseReturns, createPurchaseReturn, updatePurchaseReturn, deletePurchaseReturn };

