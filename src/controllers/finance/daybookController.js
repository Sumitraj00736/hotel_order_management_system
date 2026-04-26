const Purchase = require('../../models/finance/Purchase');
const Expense = require('../../models/finance/Expense');
const Income = require('../../models/finance/Income');
const Payment = require('../../models/finance/Payment');
const SalesReturn = require('../../models/finance/SalesReturn');
const PurchaseReturn = require('../../models/finance/PurchaseReturn');
const DaybookClose = require('../../models/finance/DaybookClose');
const SalesInvoice = require('../../models/finance/SalesInvoice');

const startOfDay = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (d) => {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
};

const initBuckets = () => ({ bank: 0, counter: 0, owner: 0, total: 0, creditDue: 0 });

const recomputeTotal = (b) => {
  const bank = Number(b.bank || 0);
  const counter = Number(b.counter || 0);
  const owner = Number(b.owner || 0);
  b.total = bank + counter + owner;
  return b;
};

const mapPaymentToBucket = (paymentMethod) => {
  const method = String(paymentMethod || '').toLowerCase();
  if (method === 'owner') return 'owner';
  if (method === 'cash') return 'counter';
  if (method === 'card' || method === 'bank' || method === 'fonepay') return 'bank';
  return 'counter';
};

/**
 * Add amount into bucket rows. Unpaid/credit amounts go to creditDue only.
 * Paid amounts go to bank/counter/owner; Total column = bank+counter+owner (excludes creditDue).
 */
const addAmount = (bucket, paymentMethod, amount, paymentStatus) => {
  const amt = Number(amount || 0);
  if (!amt) return bucket;
  if (paymentStatus === 'unpaid_credit') {
    bucket.creditDue = (bucket.creditDue || 0) + amt;
    return bucket;
  }
  const key = mapPaymentToBucket(paymentMethod);
  bucket[key] = (bucket[key] || 0) + amt;
  return recomputeTotal(bucket);
};

const sumBuckets = (...parts) => {
  const out = initBuckets();
  for (const b of parts) {
    if (!b) continue;
    out.bank += Number(b.bank || 0);
    out.counter += Number(b.counter || 0);
    out.owner += Number(b.owner || 0);
    out.creditDue += Number(b.creditDue || 0);
  }
  return recomputeTotal(out);
};

const subtractBuckets = (a, b) => {
  const out = initBuckets();
  out.bank = Number(a.bank || 0) - Number(b.bank || 0);
  out.counter = Number(a.counter || 0) - Number(b.counter || 0);
  out.owner = Number(a.owner || 0) - Number(b.owner || 0);
  out.creditDue = Number(a.creditDue || 0) - Number(b.creditDue || 0);
  return recomputeTotal(out);
};

const addBuckets = (a, b) => sumBuckets(a, b);

const legacyScalarToBuckets = (n) => {
  const v = Number(n || 0);
  const b = initBuckets();
  if (v) b.counter = v;
  return recomputeTotal(b);
};

const bucketsFromPreviousClose = (previousClose) => {
  if (previousClose?.closingBalanceBuckets && typeof previousClose.closingBalanceBuckets === 'object') {
    const c = previousClose.closingBalanceBuckets;
    const b = initBuckets();
    b.bank = Number(c.bank || 0);
    b.counter = Number(c.counter || 0);
    b.owner = Number(c.owner || 0);
    b.creditDue = Number(c.creditDue || 0);
    return recomputeTotal(b);
  }
  return legacyScalarToBuckets(previousClose?.closingBalance);
};

const bucketCashTotal = (b) => Number(b.bank || 0) + Number(b.counter || 0) + Number(b.owner || 0);

const computeDaybook = async ({ branchId, day }) => {
  const from = startOfDay(day);
  const to = endOfDay(day);

  const matchBranch = branchId ? { branchId } : {};

  const [
    salesInvoices,
    purchaseRows,
    expenseRows,
    incomeRows,
    paymentRows,
    salesReturnRows,
    purchaseReturnRows,
    previousClose
  ] = await Promise.all([
    SalesInvoice.find({ ...matchBranch, status: 'active', closedAt: { $gte: from, $lte: to } })
      .select('grandTotal amountPaid amountDue paymentStatus closedAt')
      .lean(),
    Purchase.find({ ...matchBranch, status: 'active', paidAt: { $gte: from, $lte: to } })
      .select('paymentMethod amount paymentStatus')
      .lean(),
    Expense.find({ ...matchBranch, status: 'active', paidAt: { $gte: from, $lte: to } })
      .select('paymentMethod amount paymentStatus')
      .lean(),
    Income.find({ ...matchBranch, status: 'active', txnDate: { $gte: from, $lte: to } })
      .select('paymentMethod amount paymentStatus')
      .lean(),
    Payment.find({ ...matchBranch, status: 'active', txnDate: { $gte: from, $lte: to } })
      .select('direction paymentMethod amount paymentStatus entryType invoiceId')
      .lean(),
    SalesReturn.find({ ...matchBranch, status: 'active', txnDate: { $gte: from, $lte: to } })
      .select('paymentMethod netAmount totalAmount paymentStatus')
      .lean(),
    PurchaseReturn.find({ ...matchBranch, status: 'active', billDate: { $gte: from, $lte: to } })
      .select('paymentMethod totalAmount paymentStatus')
      .lean(),
    DaybookClose.findOne({ ...matchBranch, day: { $lt: from } })
      .sort({ day: -1 })
      .select('closingBalance closingBalanceBuckets')
      .lean()
  ]);

  const netSales = initBuckets();
  const purchase = initBuckets();
  const expenses = initBuckets();
  const income = initBuckets();

  // For Net Sales, we extract the credit due directly from SalesInvoice
  for (const invoice of salesInvoices) {
    if (invoice.amountDue > 0) {
      netSales.creditDue += Number(invoice.amountDue || 0);
    }
  }

  for (const row of purchaseRows) {
    addAmount(purchase, row.paymentMethod, Number(row.amount || 0), row.paymentStatus);
  }

  for (const row of expenseRows) {
    addAmount(expenses, row.paymentMethod, Number(row.amount || 0), row.paymentStatus);
  }

  for (const row of incomeRows) {
    addAmount(income, row.paymentMethod, Number(row.amount || 0), row.paymentStatus);
  }

  const purchaseReturn = initBuckets();
  const salesReturn = initBuckets();
  const paymentIn = initBuckets();
  const paymentOut = initBuckets();
  const balanceTransferIn = initBuckets();
  const balanceTransferOut = initBuckets();

  // Parse Payments to route them correctly
  for (const row of paymentRows) {
    const amt = Number(row.amount || 0);
    const st = row.paymentStatus;
    if (row.entryType === 'balance_transfer_in') {
      addAmount(balanceTransferIn, row.paymentMethod, amt, st);
    } else if (row.entryType === 'balance_transfer_out') {
      addAmount(balanceTransferOut, row.paymentMethod, amt, st);
    } else if (row.direction === 'in') {
      // If this payment was tied to a SalesInvoice, it belongs in netSales buckets!
      if (row.invoiceId) {
        addAmount(netSales, row.paymentMethod, amt, st);
      } else {
        addAmount(paymentIn, row.paymentMethod, amt, st);
      }
    } else if (row.direction === 'out') {
      addAmount(paymentOut, row.paymentMethod, amt, st);
    }
  }

  for (const row of salesReturnRows) {
    const amt = Number(row.netAmount ?? row.totalAmount ?? 0);
    addAmount(salesReturn, row.paymentMethod, amt, row.paymentStatus);
  }

  for (const row of purchaseReturnRows) {
    addAmount(purchaseReturn, row.paymentMethod, Number(row.totalAmount || 0), row.paymentStatus);
  }

  const totalReceiptsBuckets = sumBuckets(
    netSales,
    purchaseReturn,
    paymentIn,
    income,
    balanceTransferIn
  );
  const totalPaymentsBuckets = sumBuckets(
    purchase,
    salesReturn,
    paymentOut,
    expenses,
    balanceTransferOut
  );
  const netReceiptBuckets = subtractBuckets(totalReceiptsBuckets, totalPaymentsBuckets);

  const openingBalanceBuckets = bucketsFromPreviousClose(previousClose);
  const closingBalanceBuckets = addBuckets(netReceiptBuckets, openingBalanceBuckets);

  const sumBucketAll = (b) => bucketCashTotal(b) + Number(b.creditDue || 0);

  const totalReceipts = sumBucketAll(totalReceiptsBuckets);
  const totalPayments = sumBucketAll(totalPaymentsBuckets);
  const netReceipt = totalReceipts - totalPayments;

  const openingBalance = sumBucketAll(openingBalanceBuckets);
  const closingBalance = sumBucketAll(closingBalanceBuckets);

  return {
    day: startOfDay(day),
    from,
    to,
    summary: {
      netSales,
      purchaseReturn,
      paymentIn,
      income,
      balanceTransferIn,
      purchase,
      salesReturn,
      paymentOut,
      expenses,
      balanceTransferOut
    },
    totals: {
      totalReceiptsBuckets,
      totalPaymentsBuckets,
      netReceiptBuckets,
      openingBalanceBuckets,
      closingBalanceBuckets,
      totalReceipts,
      totalPayments,
      netReceipt,
      openingBalance,
      closingBalance
    }
  };
};

const getDaybookSummary = async (req, res) => {
  try {
    const day = req.query.day || req.query.date || new Date();
    const computed = await computeDaybook({ branchId: req.branchId, day });
    return res.json(computed);
  } catch (error) {
    return res.status(500).json({ message: 'Daybook summary failed', error: error.message });
  }
};

const closeDaybook = async (req, res) => {
  try {
    const day = req.body.day || req.body.date || new Date();
    const computed = await computeDaybook({ branchId: req.branchId, day });

    const doc = await DaybookClose.findOneAndUpdate(
      { branchId: req.branchId, day: computed.day },
      {
        $set: {
          closedBy: req.user?._id,
          closedAt: new Date(),
          remarks: req.body.remarks || '',
          openingBalance: computed.totals.openingBalance,
          closingBalance: computed.totals.closingBalance,
          openingBalanceBuckets: computed.totals.openingBalanceBuckets,
          closingBalanceBuckets: computed.totals.closingBalanceBuckets,
          summary: computed.summary
        }
      },
      { new: true, upsert: true }
    );

    return res.status(201).json(doc);
  } catch (error) {
    if (String(error.message || '').includes('E11000')) {
      return res.status(409).json({ message: 'Daybook already closed for this day' });
    }
    return res.status(500).json({ message: 'Close daybook failed', error: error.message });
  }
};

/**
 * Duration: closedAt - openedAt, where openedAt = previous close's closedAt for this branch,
 * or start of the business day if there is no prior close (first daybook ever).
 */
const listDaybookHistory = async (req, res) => {
  try {
    const filter = { branchId: req.branchId };
    if (req.query.dateFrom || req.query.dateTo) {
      filter.day = {};
      if (req.query.dateFrom) filter.day.$gte = startOfDay(req.query.dateFrom);
      if (req.query.dateTo) filter.day.$lte = endOfDay(req.query.dateTo);
    }
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200);
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      DaybookClose.find(filter)
        .populate('closedBy', 'name email')
        .sort({ day: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DaybookClose.countDocuments(filter)
    ]);

    const enriched = [];
    for (const row of rows) {
      const prev = await DaybookClose.findOne({
        branchId: row.branchId,
        day: { $lt: row.day }
      })
        .sort({ day: -1 })
        .select('closedAt')
        .lean();

      const openedAt = prev?.closedAt ? new Date(prev.closedAt) : startOfDay(row.day);
      const closedAt = row.closedAt ? new Date(row.closedAt) : new Date();
      const durationMs = Math.max(0, closedAt.getTime() - openedAt.getTime());

      const ns = row.summary?.netSales || {};
      const salesAmount =
        Number(ns.bank || 0) + Number(ns.counter || 0) + Number(ns.owner || 0) + Number(ns.creditDue || 0);

      enriched.push({
        ...row,
        salesAmount,
        openedAt,
        durationMs
      });
    }

    return res.json({ data: enriched, total, page, limit });
  } catch (error) {
    return res.status(500).json({ message: 'Daybook history failed', error: error.message });
  }
};

module.exports = { getDaybookSummary, closeDaybook, listDaybookHistory, computeDaybook };
