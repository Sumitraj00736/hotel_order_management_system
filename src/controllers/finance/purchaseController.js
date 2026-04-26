const mongoose = require('mongoose');
const Purchase = require('../../models/finance/Purchase');
const Ingredient = require('../../models/inventory/Ingredient');
const StockTransaction = require('../../models/inventory/StockTransaction');
const {
  computeSimpleTotals,
  deriveSettlement,
  sanitizeAmount
} = require('../../utils/finance/calculations');

const buildPurchaseItems = (items = []) =>
  computeSimpleTotals({
    items,
    quantityKeys: ['qty', 'quantity'],
    rateKeys: ['rate', 'unitPrice'],
    amountKeys: ['amount', 'total']
  });

const buildPurchasePayload = (body, req) => {
  const lineSummary = buildPurchaseItems(Array.isArray(body.items) ? body.items : []);
  const discountType = body.discountType || 'amount';
  const discountValue =
    body.discountValue !== undefined ? body.discountValue : body.discount || 0;
  const totals = computeSimpleTotals({
    items: lineSummary.items,
    discountType,
    discountValue,
    taxRate: body.taxRate || 0,
    roundOff: body.roundOff || 0,
    quantityKeys: ['qty', 'quantity'],
    rateKeys: ['rate', 'unitPrice'],
    amountKeys: ['amount', 'total']
  });
  const settlement = deriveSettlement({
    grandTotal: totals.grandTotal,
    amountPaid:
      body.amountPaid !== undefined
        ? body.amountPaid
        : body.paymentStatus === 'unpaid_credit'
          ? 0
          : totals.grandTotal,
    requestedStatus: body.paymentStatus
  });

  return {
    branchId: req.branchId,
    supplierId: body.supplierId || undefined,
    supplierName: body.supplierName,
    referenceNo: body.referenceNo,
    title: body.title,
    billDate: body.billDate ? new Date(body.billDate) : undefined,
    billReferenceNumber: body.billReferenceNumber,
    purchaseStaff: body.purchaseStaff,
    amount: totals.grandTotal,
    subTotal: totals.subTotal,
    discountType: totals.discountType,
    discountValue: totals.discountValue,
    discountAmount: totals.discountAmount,
    taxRate: totals.taxRate,
    taxAmount: totals.taxAmount,
    taxableAmount: totals.taxableAmount,
    roundOff: totals.roundOff,
    grandTotal: totals.grandTotal,
    amountPaid: settlement.amountPaid,
    amountDue: settlement.amountDue,
    paymentStatus: settlement.amountDue > 0 ? 'unpaid_credit' : 'paid',
    paymentMethod: body.paymentMethod || 'cash',
    multiplePayment: Boolean(body.multiplePayment),
    paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
    note: body.note,
    items: totals.items.map((item) => ({
      ...item,
      quantity: item.qty,
      unitPrice: item.rate,
      total: item.amount
    })),
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    createdBy: body.createdBy || req.user?._id
  };
};

const buildIngredientDeltaMap = (items = []) => {
  const deltas = new Map();
  items.forEach((item) => {
    const ingredientId = item.ingredientId || item.stockItemId;
    const quantity = sanitizeAmount(item.qty || item.quantity || 0);
    if (!ingredientId || quantity <= 0) return;
    const key = ingredientId.toString();
    const current = deltas.get(key) || {
      ingredientId,
      delta: 0,
      rate: sanitizeAmount(item.rate || item.unitPrice || 0)
    };
    current.delta = sanitizeAmount(current.delta + quantity);
    current.rate = sanitizeAmount(item.rate || item.unitPrice || current.rate || 0);
    deltas.set(key, current);
  });
  return deltas;
};

const applyInventoryDelta = async ({ branchId, purchaseId, beforeItems = [], afterItems = [], userId, session }) => {
  const beforeMap = buildIngredientDeltaMap(beforeItems);
  const afterMap = buildIngredientDeltaMap(afterItems);
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  for (const key of keys) {
    const before = beforeMap.get(key)?.delta || 0;
    const after = afterMap.get(key)?.delta || 0;
    const delta = sanitizeAmount(after - before);
    if (!delta) continue;

    const ingredient = await Ingredient.findOne({
      _id: afterMap.get(key)?.ingredientId || beforeMap.get(key)?.ingredientId,
      ...(branchId ? { branchId } : {})
    }).session(session);

    if (!ingredient) {
      throw new Error('Linked ingredient not found for purchase item');
    }

    const nextStock = sanitizeAmount((ingredient.currentStock || 0) + delta);
    if (nextStock < 0) {
      throw new Error(`Insufficient stock to adjust ingredient ${ingredient.name}`);
    }

    ingredient.currentStock = nextStock;
    ingredient.lastRestockedAt = new Date();
    await ingredient.save({ session });
  }

  if (keys.size > 0) {
    await StockTransaction.deleteMany({ referencePurchase: purchaseId }).session(session);
  }

  const transactions = [];
  afterMap.forEach((entry) => {
    if (entry.delta <= 0) return;
    transactions.push({
      branchId,
      ingredient: entry.ingredientId,
      delta: entry.delta,
      reason: 'restock',
      referencePurchase: purchaseId,
      unitCost: entry.rate,
      totalCost: sanitizeAmount(entry.delta * entry.rate),
      note: `Purchase Bill: ${String(purchaseId).slice(-6)}`,
      createdBy: userId
    });
  });

  if (transactions.length > 0) {
    await StockTransaction.insertMany(transactions, { session });
  }
};

const listPurchases = async (req, res) => {
  const filter = { status: 'active' };
  if (req.branchId) filter.branchId = req.branchId;
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
  const session = await mongoose.startSession();
  try {
    let purchase;
    await session.withTransaction(async () => {
      const payload = buildPurchasePayload(req.body, req);
      [purchase] = await Purchase.create([payload], { session });
      await applyInventoryDelta({
        branchId: req.branchId,
        purchaseId: purchase._id,
        beforeItems: [],
        afterItems: purchase.items,
        userId: req.user?._id,
        session
      });
    });
    return res.status(201).json(purchase);
  } catch (error) {
    return res.status(500).json({ message: 'Create purchase failed', error: error.message });
  } finally {
    session.endSession();
  }
};

const updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let purchase;
    await session.withTransaction(async () => {
      const existing = await Purchase.findOne({
        _id: req.params.id,
        status: 'active',
        ...(req.branchId ? { branchId: req.branchId } : {})
      }).session(session);

      if (!existing) {
        throw new Error('Purchase not found or already voided');
      }

      const payload = buildPurchasePayload({ ...existing.toObject(), ...req.body }, req);
      purchase = await Purchase.findOneAndUpdate(
        { _id: req.params.id, status: 'active', ...(req.branchId ? { branchId: req.branchId } : {}) },
        { $set: payload },
        { new: true, session }
      );

      await applyInventoryDelta({
        branchId: req.branchId,
        purchaseId: purchase._id,
        beforeItems: existing.items,
        afterItems: purchase.items,
        userId: req.user?._id,
        session
      });
    });
    return res.json(purchase);
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

const deletePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const purchase = await Purchase.findOne({
        _id: req.params.id,
        status: 'active',
        ...(req.branchId ? { branchId: req.branchId } : {})
      }).session(session);

      if (!purchase) {
        throw new Error('Purchase not found or already voided');
      }

      await applyInventoryDelta({
        branchId: req.branchId,
        purchaseId: purchase._id,
        beforeItems: purchase.items,
        afterItems: [],
        userId: req.user?._id,
        session
      });

      purchase.status = 'void';
      purchase.voidReason = req.body.reason || 'Voided via UI';
      purchase.voidedAt = new Date();
      purchase.voidedBy = req.user?._id;
      purchase.amountPaid = 0;
      purchase.amountDue = purchase.grandTotal;
      purchase.paymentStatus = 'unpaid_credit';
      await purchase.save({ session });
    });
    return res.json({ message: 'Purchase successfully voided' });
  } catch (error) {
    return res.status(error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

module.exports = { listPurchases, createPurchase, updatePurchase, deletePurchase };
