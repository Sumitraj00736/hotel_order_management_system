const Supplier = require('../../models/core/Supplier');
const Purchase = require('../../models/finance/Purchase');
const Payment = require('../../models/finance/Payment');

const listSuppliers = async (req, res) => {
  try {
    const filter = {};
    if (req.branchId) filter.branchId = req.branchId;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const suppliers = await Supplier.find(filter).sort({ name: 1 });

    // Compute balance summary for each supplier
    const branchFilter = req.branchId ? { branchId: req.branchId } : {};

    let toReceive = 0;
    let toPay = 0;

    const enriched = await Promise.all(
      suppliers.map(async (s) => {
        // Total purchases from this supplier (we owe them)
        const purchasesAgg = await Purchase.aggregate([
          { $match: { ...branchFilter, supplierId: s._id, paymentStatus: 'unpaid_credit' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const purchaseDue = purchasesAgg[0]?.total || 0;

        // Payments made to this supplier (direction: out)
        const paymentsAgg = await Payment.aggregate([
          { $match: { ...branchFilter, partyId: s._id, partyType: 'supplier', direction: 'out' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const paidOut = paymentsAgg[0]?.total || 0;

        // Opening balance adjustment
        const openingAdj = s.openingBalanceType === 'cr' ? s.openingAmount : -s.openingAmount;
        const dueAmount = purchaseDue - paidOut + openingAdj;

        if (dueAmount > 0) toPay += dueAmount;
        else toReceive += Math.abs(dueAmount);

        return {
          ...s.toObject(),
          dueAmount
        };
      })
    );

    return res.json({
      suppliers: enriched,
      summary: {
        toReceive,
        toPay,
        netToReceive: toReceive - toPay
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch suppliers', error: error.message });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { name, phone, email, address, legalName, taxNumber, dob, openingBalanceType, openingAmount } = req.body;
    if (!name) return res.status(400).json({ message: 'Supplier name is required' });

    const supplier = await Supplier.create({
      branchId: req.branchId,
      name: name.trim(),
      phone,
      email,
      address,
      legalName,
      taxNumber,
      dob: dob ? new Date(dob) : undefined,
      openingBalanceType: openingBalanceType || 'dr',
      openingAmount: Number(openingAmount || 0),
      createdBy: req.user?._id
    });

    return res.status(201).json(supplier);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A supplier with this name already exists' });
    }
    return res.status(400).json({ message: 'Create supplier failed', error: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'email', 'address', 'legalName', 'taxNumber', 'dob', 'openingBalanceType', 'openingAmount'];
    const updates = allowedFields.reduce((acc, key) => {
      if (req.body[key] !== undefined) {
        acc[key] = req.body[key];
      }
      return acc;
    }, {});

    if (updates.dob) updates.dob = new Date(updates.dob);
    if (updates.openingAmount !== undefined) updates.openingAmount = Number(updates.openingAmount);

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      { $set: updates },
      { new: true }
    );

    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    return res.json(supplier);
  } catch (error) {
    return res.status(400).json({ message: 'Update supplier failed', error: error.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndDelete({
      _id: req.params.id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    return res.json({ message: 'Supplier deleted successfully' });
  } catch (error) {
    return res.status(400).json({ message: 'Delete supplier failed', error: error.message });
  }
};

const getSupplierLedger = async (req, res) => {
  try {
    const supplierId = req.params.id;
    const branchFilter = req.branchId ? { branchId: req.branchId } : {};

    const supplier = await Supplier.findOne({ _id: supplierId, ...branchFilter });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

    const purchases = await Purchase.find({ ...branchFilter, supplierId }).sort({ paidAt: -1 });
    const payments = await Payment.find({ ...branchFilter, partyId: supplierId, partyType: 'supplier' }).sort({ txnDate: -1 });

    const ledger = [
      ...purchases.map(p => ({
        _id: p._id,
        date: p.paidAt || p.createdAt,
        type: 'purchase',
        description: p.title || `Purchase Bill #${p.billReferenceNumber || p._id.toString().slice(-6)}`,
        debit: p.amount,
        credit: 0,
        referenceNo: p.billReferenceNumber
      })),
      ...payments.map(p => ({
        _id: p._id,
        date: p.txnDate || p.createdAt,
        type: 'payment',
        description: `Payment ${p.direction === 'out' ? 'to' : 'from'} supplier`,
        debit: 0,
        credit: p.direction === 'out' ? p.amount : 0,
        referenceNo: p.referenceNo
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Running balance
    let balance = supplier.openingBalanceType === 'cr' ? supplier.openingAmount : -supplier.openingAmount;
    const ledgerWithBalance = ledger.map(row => {
      balance = balance + row.debit - row.credit;
      return { ...row, balance };
    });

    return res.json({ supplier, ledger: ledgerWithBalance, closingBalance: balance });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to get ledger', error: error.message });
  }
};

module.exports = { listSuppliers, createSupplier, updateSupplier, deleteSupplier, getSupplierLedger };
