const Order = require('../../models/orders/Order');
const Table = require('../../models/tables/Table');
const CustomerHistory = require('../../models/customers/CustomerHistory');
const Purchase = require('../../models/finance/Purchase');
const Expense = require('../../models/finance/Expense');
const Income = require('../../models/finance/Income');
const Payment = require('../../models/finance/Payment');
const SalesReturn = require('../../models/finance/SalesReturn');
const PurchaseReturn = require('../../models/finance/PurchaseReturn');
const User = require('../../models/users/User');
const Category = require('../../models/menu/Category');
const AddOn = require('../../models/menu/AddOn');

const buildDateRange = (req) => {
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
  return { dateFrom, dateTo };
};

const buildRangeMatch = (field, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return {};
  const range = {};
  if (dateFrom) range.$gte = dateFrom;
  if (dateTo) range.$lte = dateTo;
  return { [field]: range };
};

/** Max rows merged in memory per request — keeps pagination correct without unbounded RAM use. */
const TRANSACTION_MERGE_CAP = 12000;

const mapTransactionRows = async ({ branchId, dateFrom, dateTo, limit = 50, page = 1 }) => {
  const branchMatch = branchId ? { branchId } : {};
  const salesMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
  const purchaseMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
  const expenseMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
  const incomeMatch = { ...branchMatch, ...buildRangeMatch('txnDate', dateFrom, dateTo) };
  const paymentMatch = { ...branchMatch, ...buildRangeMatch('txnDate', dateFrom, dateTo) };
  const salesReturnMatch = { ...branchMatch, ...buildRangeMatch('txnDate', dateFrom, dateTo) };
  const purchaseReturnMatch = { ...branchMatch, ...buildRangeMatch('billDate', dateFrom, dateTo) };

  const [
    sales,
    purchases,
    expenses,
    incomes,
    payments,
    salesReturns,
    purchaseReturns,
    salesCount,
    purchaseCount,
    expenseCount,
    incomeCount,
    paymentCount,
    salesReturnCount,
    purchaseReturnCount
  ] = await Promise.all([
    CustomerHistory.find(salesMatch).sort({ paidAt: -1 }).lean(),
    Purchase.find(purchaseMatch).sort({ paidAt: -1 }).lean(),
    Expense.find(expenseMatch).sort({ paidAt: -1 }).lean(),
    Income.find(incomeMatch).sort({ txnDate: -1 }).lean(),
    Payment.find(paymentMatch).sort({ txnDate: -1 }).lean(),
    SalesReturn.find(salesReturnMatch).sort({ txnDate: -1 }).lean(),
    PurchaseReturn.find(purchaseReturnMatch).sort({ billDate: -1 }).lean(),
    CustomerHistory.countDocuments(salesMatch),
    Purchase.countDocuments(purchaseMatch),
    Expense.countDocuments(expenseMatch),
    Income.countDocuments(incomeMatch),
    Payment.countDocuments(paymentMatch),
    SalesReturn.countDocuments(salesReturnMatch),
    PurchaseReturn.countDocuments(purchaseReturnMatch)
  ]);

  const tableNums = [...new Set(sales.map((r) => r.tableNumber).filter((n) => n != null && n !== ''))];
  let tableLabelMap = new Map();
  if (branchId && tableNums.length) {
    const tables = await Table.find({
      branchId,
      tableNumber: { $in: tableNums }
    })
      .select('tableNumber name type')
      .lean();
    tableLabelMap = new Map(
      tables.map((t) => {
        const label =
          t.name && String(t.name).trim()
            ? String(t.name).trim()
            : `${String(t.type || 'table').replace(/_/g, ' ')} ${t.tableNumber}`;
        return [t.tableNumber, label];
      })
    );
  }

  const particularForSale = (row) => {
    if (row.tableNumber == null || row.tableNumber === '') return 'Walk-in / Sales';
    return tableLabelMap.get(row.tableNumber) || `Table ${row.tableNumber}`;
  };

  const userIds = [
    ...purchases.map((row) => row.createdBy).filter(Boolean),
    ...expenses.map((row) => row.createdBy).filter(Boolean),
    ...incomes.map((row) => row.createdBy).filter(Boolean),
    ...payments.map((row) => row.createdBy).filter(Boolean),
    ...salesReturns.map((row) => row.createdBy).filter(Boolean),
    ...purchaseReturns.map((row) => row.createdBy).filter(Boolean)
  ];
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('name') : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));

  const salesRows = sales.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.paidAt,
    txnNo: row.invoiceNo || row.orderId?.toString() || '-',
    particular: particularForSale(row),
    txnType: 'Sales',
    parties: row.customerName || '-',
    paymentMode: row.paymentMethod || '-',
    amount: row.finalAmount || row.totalAmount || 0,
    status: 'paid',
    entryBy: row.waiter?.name || 'System'
  }));

  const purchaseRows = purchases.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.paidAt,
    txnNo: row.referenceNo || row._id.toString(),
    particular: row.title || 'Purchase',
    txnType: 'Purchase',
    parties: row.supplierName || '-',
    paymentMode: row.paymentMethod || '-',
    amount: row.amount || 0,
    status: 'paid',
    entryBy: row.createdBy ? userMap.get(row.createdBy.toString()) || 'System' : 'System'
  }));

  const expenseRows = expenses.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.paidAt,
    txnNo: row._id.toString(),
    particular: row.title || 'Expense',
    txnType: 'Expense',
    parties: row.category || '-',
    paymentMode: row.paymentMethod || '-',
    amount: row.amount || 0,
    status: 'paid',
    entryBy: row.createdBy ? userMap.get(row.createdBy.toString()) || 'System' : 'System'
  }));

  const incomeRows = incomes.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.txnDate,
    txnNo: row.referenceNo || row._id.toString(),
    particular: row.accountHead || 'Income',
    txnType: 'Income',
    parties: row.partyName || row.partyType || '-',
    paymentMode: row.paymentMethod || '-',
    amount: row.amount || 0,
    status: row.paymentStatus === 'unpaid_credit' ? 'unpaid' : 'paid',
    entryBy: row.createdBy ? userMap.get(row.createdBy.toString()) || 'System' : 'System'
  }));

  const paymentRows = payments.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.txnDate,
    txnNo: row.referenceNo || row._id.toString(),
    particular: row.accountHead || (row.direction === 'in' ? 'Payment In' : 'Payment Out'),
    txnType: row.direction === 'in' ? 'Payment In' : 'Payment Out',
    parties: row.partyName || row.partyType || '-',
    paymentMode: row.paymentMethod || '-',
    amount: row.amount || 0,
    status: row.paymentStatus === 'unpaid_credit' ? 'unpaid' : 'paid',
    entryBy: row.createdBy ? userMap.get(row.createdBy.toString()) || 'System' : 'System'
  }));

  const salesReturnRows = salesReturns.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.txnDate,
    txnNo: row.billReferenceNumber || row._id.toString(),
    particular: 'Sales Return',
    txnType: 'Sales Return',
    parties: row.customerName || '-',
    paymentMode: row.paymentMethod || '-',
    amount: row.netAmount || row.totalAmount || 0,
    status: row.paymentStatus === 'unpaid_credit' ? 'unpaid' : 'paid',
    entryBy: row.createdBy ? userMap.get(row.createdBy.toString()) || 'System' : 'System'
  }));

  const purchaseReturnRows = purchaseReturns.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.billDate,
    txnNo: row.billReferenceNumber || row._id.toString(),
    particular: 'Purchase Return',
    txnType: 'Purchase Return',
    parties: row.supplierName || '-',
    paymentMode: row.paymentMethod || '-',
    amount: row.totalAmount || 0,
    status: row.paymentStatus === 'unpaid_credit' ? 'unpaid' : 'paid',
    entryBy: row.createdBy ? userMap.get(row.createdBy.toString()) || 'System' : 'System'
  }));

  const combined = [
    ...salesRows,
    ...purchaseRows,
    ...expenseRows,
    ...incomeRows,
    ...paymentRows,
    ...salesReturnRows,
    ...purchaseReturnRows
  ].sort((a, b) => new Date(b.txnDate) - new Date(a.txnDate));

  const total =
    salesCount +
    purchaseCount +
    expenseCount +
    incomeCount +
    paymentCount +
    salesReturnCount +
    purchaseReturnCount;

  const capped = combined.length > TRANSACTION_MERGE_CAP ? combined.slice(0, TRANSACTION_MERGE_CAP) : combined;
  const truncated = combined.length > TRANSACTION_MERGE_CAP;

  const start = (page - 1) * limit;
  const paged = capped.slice(start, start + limit);
  return {
    data: paged,
    total,
    page,
    limit,
    ...(truncated && {
      warning: `Results capped at ${TRANSACTION_MERGE_CAP} rows; narrow date filters for full history.`
    })
  };
};

const transactionHistory = async (req, res) => {
  try {
    const { dateFrom, dateTo } = buildDateRange(req);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const rows = await mapTransactionRows({ branchId: req.branchId, dateFrom, dateTo, limit, page });

    if (req.query.format === 'csv') {
      const headers = ['Entry Date', 'TXN Date', 'TXN No', 'Particular', 'TXN Type', 'Parties', 'PMT Mode', 'Amount', 'Status', 'Entry By'];
      const lines = rows.data.map((row) => [
        row.entryDate ? new Date(row.entryDate).toISOString() : '',
        row.txnDate ? new Date(row.txnDate).toISOString() : '',
        row.txnNo,
        row.particular,
        row.txnType,
        row.parties,
        row.paymentMode,
        row.amount,
        row.status,
        row.entryBy
      ]);
      const csv = [headers, ...lines]
        .map((line) => line.map((val) => `"${String(val ?? '').replace(/\"/g, '""')}"`).join(','))
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transaction-history.csv"');
      return res.send(csv);
    }

    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ message: 'Transaction history failed', error: error.message });
  }
};

const orderDashboard = async (req, res) => {
  try {
    const branchMatch = req.branchId ? { branchId: req.branchId } : {};
    const totalSalesAgg = await Order.aggregate([
      { $match: { ...branchMatch, $or: [{ status: 'paid' }, { paymentStatus: 'paid' }] } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$finalAmount', '$totalAmount'] } }, count: { $sum: 1 } } }
    ]);
    const totalSales = totalSalesAgg[0]?.total || 0;
    const served = await Order.countDocuments({ ...branchMatch, status: 'served' });
    const kotTaken = await Order.countDocuments({ ...branchMatch });
    const avgOrderAmount = totalSalesAgg[0]?.count ? totalSales / totalSalesAgg[0].count : 0;

    const statusCountsAgg = await Order.aggregate([
      { $match: branchMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusCounts = statusCountsAgg.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const discountAgg = await Order.aggregate([
      { $match: branchMatch },
      { $group: { _id: null, totalDiscount: { $sum: '$discountAmount' } } }
    ]);

    const topTableAgg = await CustomerHistory.aggregate([
      { $match: branchMatch },
      { $group: { _id: '$tableNumber', sales: { $sum: '$totalAmount' } } },
      { $sort: { sales: -1 } },
      { $limit: 1 }
    ]);

    const orderSeries = await CustomerHistory.aggregate([
      { $match: branchMatch },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const formattedOrderSeries = orderSeries.map((row) => ({
      month: `${row._id.month}/${row._id.year}`,
      orders: row.orders
    }));

    return res.json({
      kpis: {
        sales: totalSales,
        orderServed: served,
        kotTaken,
        avgOrderAmount: Math.round(avgOrderAmount)
      },
      liveStatus: {
        completed: statusCounts.paid || 0,
        pending: statusCounts.pending || 0,
        cancelled: statusCounts.cancelled || 0
      },
      checkoutBreakdown: {
        dishDiscount: 0,
        generalDiscount: discountAgg[0]?.totalDiscount || 0,
        loyaltyDiscount: 0,
        serviceCharge: 0
      },
      topSellingTable: topTableAgg[0] || null,
      salesBySubmenus: [],
      orderSeries: formattedOrderSeries
    });
  } catch (error) {
    return res.status(500).json({ message: 'Order dashboard failed', error: error.message });
  }
};

const overviewDashboard = async (req, res) => {
  try {
    const branchMatch = req.branchId ? { branchId: req.branchId } : {};
    const staffAgg = await CustomerHistory.aggregate([
      { $match: { ...branchMatch, 'waiter.id': { $ne: null } } },
      { $group: { _id: '$waiter.id', name: { $first: '$waiter.name' }, sales: { $sum: '$totalAmount' } } },
      { $sort: { sales: -1 } },
      { $limit: 5 }
    ]);

    const topCustomers = await CustomerHistory.aggregate([
      { $match: branchMatch },
      { $group: { _id: '$customerName', orders: { $sum: 1 }, total: { $sum: '$totalAmount' } } },
      { $sort: { total: -1 } },
      { $limit: 5 }
    ]);

    const topDishes = await CustomerHistory.aggregate([
      { $match: branchMatch },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' } } },
      { $sort: { qty: -1 } },
      { $limit: 5 }
    ]);

    const [categories, addons] = await Promise.all([
      Category.find(branchMatch).limit(5),
      AddOn.find(branchMatch).limit(5)
    ]);

    return res.json({
      salesByStaff: staffAgg,
      topCustomers,
      bestSelling: {
        dishes: topDishes,
        addons,
        categories
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Overview dashboard failed', error: error.message });
  }
};

const financeDashboard = async (req, res) => {
  try {
    const branchMatch = req.branchId ? { branchId: req.branchId } : {};
    const { dateFrom, dateTo } = buildDateRange(req);

    const salesMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
    const purchaseMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
    const expenseMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
    const incomeMatch = { ...branchMatch, ...buildRangeMatch('txnDate', dateFrom, dateTo) };
    const paymentMatch = { ...branchMatch, ...buildRangeMatch('txnDate', dateFrom, dateTo) };

    const [sales, purchases, expenses, incomes, paymentInAgg, paymentOutAgg] = await Promise.all([
      CustomerHistory.aggregate([
        { $match: salesMatch },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ['$finalAmount', '$totalAmount'] } }
          }
        }
      ]),
      Purchase.aggregate([{ $match: purchaseMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Income.aggregate([{ $match: incomeMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([
        { $match: { ...paymentMatch, direction: 'in' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Payment.aggregate([
        { $match: { ...paymentMatch, direction: 'out' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    const totalSales = sales[0]?.total || 0;
    const purchase = purchases[0]?.total || 0;
    const expense = expenses[0]?.total || 0;
    const income = incomes[0]?.total || 0;
    const paymentIn = paymentInAgg[0]?.total || 0;
    const paymentOut = paymentOutAgg[0]?.total || 0;

    const salesSeries = await CustomerHistory.aggregate([
      { $match: salesMatch },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          sales: { $sum: { $ifNull: ['$finalAmount', '$totalAmount'] } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);
    const formattedSalesSeries = salesSeries.map((row) => ({
      month: `${row._id.month}/${row._id.year}`,
      sales: row.sales
    }));

    return res.json({
      kpis: {
        sales: totalSales,
        purchase,
        income,
        expenses: expense,
        paymentIn,
        paymentOut
      },
      salesSeries: formattedSalesSeries
    });
  } catch (error) {
    return res.status(500).json({ message: 'Finance dashboard failed', error: error.message });
  }
};

module.exports = {
  transactionHistory,
  orderDashboard,
  overviewDashboard,
  financeDashboard
};
