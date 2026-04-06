const Order = require('../models/Order');
const CustomerHistory = require('../models/CustomerHistory');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const User = require('../models/User');
const Category = require('../models/Category');
const AddOn = require('../models/AddOn');

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

const mapTransactionRows = async ({ branchId, dateFrom, dateTo, limit = 50, page = 1 }) => {
  const branchMatch = branchId ? { branchId } : {};
  const salesMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
  const purchaseMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };
  const expenseMatch = { ...branchMatch, ...buildRangeMatch('paidAt', dateFrom, dateTo) };

  const [sales, purchases, expenses, salesCount, purchaseCount, expenseCount] = await Promise.all([
    CustomerHistory.find(salesMatch).sort({ paidAt: -1 }).limit(limit).lean(),
    Purchase.find(purchaseMatch).sort({ paidAt: -1 }).limit(limit).lean(),
    Expense.find(expenseMatch).sort({ paidAt: -1 }).limit(limit).lean(),
    CustomerHistory.countDocuments(salesMatch),
    Purchase.countDocuments(purchaseMatch),
    Expense.countDocuments(expenseMatch)
  ]);

  const userIds = [
    ...purchases.map((row) => row.createdBy).filter(Boolean),
    ...expenses.map((row) => row.createdBy).filter(Boolean)
  ];
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }).select('name') : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u.name]));

  const salesRows = sales.map((row) => ({
    entryDate: row.createdAt,
    txnDate: row.paidAt,
    txnNo: row.invoiceNo || row.orderId?.toString() || '-',
    particular: 'Sales',
    txnType: 'Sale',
    parties: row.customerName || 'Cash Customer',
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

  const combined = [...salesRows, ...purchaseRows, ...expenseRows].sort((a, b) => new Date(b.txnDate) - new Date(a.txnDate));
  const start = (page - 1) * limit;
  const paged = combined.slice(start, start + limit);
  return {
    data: paged,
    total: salesCount + purchaseCount + expenseCount,
    page,
    limit
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
    const [sales, purchases, expenses] = await Promise.all([
      CustomerHistory.aggregate([
        { $match: branchMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Purchase.aggregate([{ $match: branchMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Expense.aggregate([{ $match: branchMatch }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);

    const totalSales = sales[0]?.total || 0;
    const purchase = purchases[0]?.total || 0;
    const expense = expenses[0]?.total || 0;

    const salesSeries = await CustomerHistory.aggregate([
      { $match: branchMatch },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          sales: { $sum: '$totalAmount' }
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
        income: totalSales,
        expenses: expense,
        paymentIn: totalSales,
        paymentOut: purchase + expense
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
