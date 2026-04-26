const mongoose = require('mongoose');
const Payment = require('../../models/finance/Payment');
const MathUtils = require('../../utils/mathUtils');

const listPayments = async (req, res) => {
  try {
    const filter = { status: 'active' };
    if (req.branchId) filter.branchId = req.branchId;
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
  const session = await mongoose.startSession();
  try {
    let payment;
    await session.withTransaction(async () => {
      const payload = {
        branchId: req.branchId,
        invoiceId: req.body.invoiceId || undefined,
        direction: req.body.direction,
        amount: MathUtils.roundAmount(req.body.amount),
        entryType: req.body.entryType || 'normal',
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
      
      const [newPayment] = await Payment.create([payload], { session });
      payment = newPayment;
    });
    return res.status(201).json(payment);
  } catch (error) {
    return res.status(500).json({ message: 'Create payment failed', error: error.message });
  } finally {
    session.endSession();
  }
};

const updatePayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let payment;
    await session.withTransaction(async () => {
      const update = {
        invoiceId: req.body.invoiceId !== undefined ? req.body.invoiceId : undefined,
        direction: req.body.direction,
        amount: req.body.amount !== undefined ? MathUtils.roundAmount(req.body.amount) : undefined,
        entryType: req.body.entryType,
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

      Object.keys(update).forEach(key => update[key] === undefined && delete update[key]);

      payment = await Payment.findOneAndUpdate(
        { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
        { $set: update },
        { new: true, session }
      );
      
      if (!payment) throw new Error('Payment not found or already voided');
    });
    return res.json(payment);
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

const deletePayment = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findOneAndUpdate(
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
      
      if (!payment) throw new Error('Payment not found or already voided');
    });
    return res.json({ message: 'Payment successfully voided' });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

module.exports = { listPayments, createPayment, updatePayment, deletePayment };
