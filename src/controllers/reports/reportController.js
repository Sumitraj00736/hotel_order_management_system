const Order = require('../../models/orders/Order');
const User = require('../../models/users/User');
const SalesInvoice = require('../../models/finance/SalesInvoice');
const UserBranchRole = require('../../models/users/UserBranchRole');
const OrderModel = require('../../models/orders/Order');
const Purchase = require('../../models/finance/Purchase');
const Expense = require('../../models/finance/Expense');
const Income = require('../../models/finance/Income');
const Payment = require('../../models/finance/Payment');
const { getCache, setCache } = require('../../utils/performance/cache');

const buildSummaryData = async ({ branchId, dateFrom, dateTo }) => {
  const filter = {};
  if (branchId) filter.branchId = branchId;
  const hasDateFilter = Boolean(dateFrom || dateTo);

  const totalOrders = await Order.countDocuments(filter);

  const invoiceMatch = {
    ...(branchId ? { branchId } : {}),
    status: 'active'
  };
  if (hasDateFilter) {
    invoiceMatch.closedAt = {};
    if (dateFrom) invoiceMatch.closedAt.$gte = new Date(dateFrom);
    if (dateTo) invoiceMatch.closedAt.$lte = new Date(dateTo);
  }

  const invoiceAgg = await SalesInvoice.aggregate([
    { $match: invoiceMatch },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$grandTotal' },
        amountPaid: { $sum: '$amountPaid' },
        amountDue: { $sum: '$amountDue' },
        dineIn: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'dine_in'] }, '$grandTotal', 0]
          }
        },
        delivery: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'delivery'] }, '$grandTotal', 0]
          }
        },
        takeaway: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'takeaway'] }, '$grandTotal', 0]
          }
        },
        reservation: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'online'] }, '$grandTotal', 0]
          }
        }
      }
    }
  ]);

  const unpaidMatch = {
    ...filter,
    status: { $ne: 'paid' },
    paymentStatus: { $ne: 'paid' }
  };
  if (hasDateFilter) {
    unpaidMatch.createdAt = {};
    if (dateFrom) unpaidMatch.createdAt.$gte = new Date(dateFrom);
    if (dateTo) unpaidMatch.createdAt.$lte = new Date(dateTo);
  }
  const unpaidAgg = await Order.aggregate([
    { $match: unpaidMatch },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$finalAmount', '$totalAmount'] } } } }
  ]);

  const statusMatch = branchId ? { branchId } : {};
  const byStatusAgg = await Order.aggregate([
    { $match: statusMatch },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const byStatus = byStatusAgg.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const totalSales = invoiceAgg[0]?.totalSales || 0;
  const paidTotal = invoiceAgg[0]?.amountPaid || 0;
  const unpaidTotal = invoiceAgg[0]?.amountDue || unpaidAgg[0]?.total || 0;
  const typeTotals = {
    dineIn: invoiceAgg[0]?.dineIn || 0,
    delivery: invoiceAgg[0]?.delivery || 0,
    takeaway: invoiceAgg[0]?.takeaway || 0,
    reservation: invoiceAgg[0]?.reservation || 0
  };

  const purchaseMatch = branchId ? { branchId } : {};
  const expenseMatch = branchId ? { branchId } : {};
  if (hasDateFilter) {
    const range = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    if (dateTo) range.$lte = new Date(dateTo);
    purchaseMatch.paidAt = range;
    expenseMatch.paidAt = range;
  }

  const purchaseAgg = await Purchase.aggregate([
    { $match: { ...purchaseMatch, status: 'active' } },
    { $group: { _id: null, total: { $sum: { $ifNull: ['$grandTotal', '$amount'] } } } }
  ]);
  const expenseAgg = await Expense.aggregate([
    { $match: { ...expenseMatch, status: 'active' } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const incomeAgg = await Income.aggregate([
    { $match: { ...(branchId ? { branchId } : {}), status: 'active', ...(hasDateFilter ? { txnDate: purchaseMatch.paidAt } : {}) } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const paymentInAgg = await Payment.aggregate([
    {
      $match: {
        ...(branchId ? { branchId } : {}),
        status: 'active',
        direction: 'in',
        ...(hasDateFilter ? { txnDate: purchaseMatch.paidAt } : {})
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const paymentOutAgg = await Payment.aggregate([
    {
      $match: {
        ...(branchId ? { branchId } : {}),
        status: 'active',
        direction: 'out',
        ...(hasDateFilter ? { txnDate: purchaseMatch.paidAt } : {})
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const purchase = purchaseAgg[0]?.total || 0;
  const expenses = expenseAgg[0]?.total || 0;
  const paymentIn = paymentInAgg[0]?.total || 0;
  const paymentOut = paymentOutAgg[0]?.total || 0;
  const income = incomeAgg[0]?.total || 0;

  return {
    totalOrders,
    totalSales,
    byStatus,
    paid: paidTotal,
    unpaid: unpaidTotal,
    dineIn: typeTotals.dineIn,
    delivery: typeTotals.delivery,
    takeaway: typeTotals.takeaway,
    reservation: typeTotals.reservation,
    purchase,
    income,
    expenses,
    paymentIn,
    paymentOut
  };
};

const summaryReport = async (req, res) => {
  const data = await buildSummaryData({
    branchId: req.branchId,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo
  });
  return res.json(data);
};

const buildOverviewData = async ({ branchId }) => {
  const filter = { status: { $in: ['pending', 'preparing', 'ready', 'served'] } };
  if (branchId) filter.branchId = branchId;
  const activeOrders = await Order.find(filter)
    .populate('table')
    .populate('createdBy', 'name email')
    .populate('kitchenAssigned', 'name email');

  const unpaidOrders = await Order.countDocuments({ status: { $ne: 'paid' }, ...(branchId ? { branchId } : {}) });
  const statusMatch = branchId ? { branchId } : {};
  const statusCountsAgg = await Order.aggregate([
    { $match: statusMatch },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const statusCounts = statusCountsAgg.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  const activeByWaiter = activeOrders.reduce((acc, order) => {
    const waiterName = order.createdBy?.name || 'Unknown';
    if (!acc[waiterName]) acc[waiterName] = [];
    acc[waiterName].push({
      tableNumber: order.table?.tableNumber,
      status: order.status,
      orderId: order._id
    });
    return acc;
  }, {});

  const waiterList = Object.entries(activeByWaiter).map(([waiter, tables]) => ({ waiter, tables }));

  const kitchenLoadsMap = activeOrders.reduce((acc, order) => {
    const kitchenName = order.kitchenAssigned?.name || 'Unassigned';
    if (!acc[kitchenName]) acc[kitchenName] = 0;
    acc[kitchenName] += 1;
    return acc;
  }, {});
  const kitchenLoads = Object.entries(kitchenLoadsMap).map(([name, orders]) => ({ name, orders }));

  const topWaiter =
    waiterList.length > 0
      ? waiterList.reduce((best, w) => (w.tables.length > (best?.tables.length || 0) ? w : best), null)
      : null;
  const topKitchen =
    kitchenLoads.length > 0
      ? kitchenLoads.reduce((best, k) => (k.orders > (best?.orders || 0) ? k : best), null)
      : null;

  return {
    activeByWaiter: waiterList,
    activeOrders: activeOrders.length,
    unpaidOrders,
    statusCounts,
    kitchenLoads,
    topWaiter,
    topKitchen
  };
};

const overviewReport = async (req, res) => {
  const data = await buildOverviewData({ branchId: req.branchId });
  return res.json(data);
};

const monthsAgo = (months) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

const getMonthKey = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
};

const lastNMonths = (n) => {
  const now = new Date();
  const months = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: getMonthKey(d), label: d.toLocaleString('default', { month: 'short' }), year: d.getFullYear() });
  }
  return months;
};

const lastNDays = (n) => {
  const now = new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.toLocaleDateString() });
  }
  return days;
};

const buildMonthlySeries = async ({ months = 6, match = {} }) => {
  const startDate = monthsAgo(months - 1);
  const buckets = lastNMonths(months);
  const aggregation = await SalesInvoice.aggregate([
    { $match: { status: 'active', closedAt: { $gte: startDate }, ...match } },
    {
      $group: {
        _id: {
          year: { $year: '$closedAt' },
          month: { $month: '$closedAt' }
        },
        sales: { $sum: '$grandTotal' },
        orders: { $sum: 1 }
      }
    }
  ]);

  const lookup = new Map(
    aggregation.map((row) => [
      `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
      { sales: row.sales, orders: row.orders }
    ])
  );

  return buckets.map((bucket) => {
    const data = lookup.get(bucket.key) || { sales: 0, orders: 0 };
    return {
      month: `${bucket.label} ${bucket.year}`,
      sales: data.sales,
      orders: data.orders
    };
  });
};

const buildDailySeries = async ({ days = 7, match = {} }) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const buckets = lastNDays(days);
  const aggregation = await SalesInvoice.aggregate([
    { $match: { status: 'active', closedAt: { $gte: startDate }, ...match } },
    {
      $group: {
        _id: {
          year: { $year: '$closedAt' },
          month: { $month: '$closedAt' },
          day: { $dayOfMonth: '$closedAt' }
        },
        sales: { $sum: '$grandTotal' },
        orders: { $sum: 1 }
      }
    }
  ]);

  const lookup = new Map(
    aggregation.map((row) => {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`;
      return [key, { sales: row.sales, orders: row.orders }];
    })
  );

  return buckets.map((bucket) => {
    const data = lookup.get(bucket.key) || { sales: 0, orders: 0 };
    return {
      day: bucket.label,
      sales: data.sales,
      orders: data.orders
    };
  });
};

const buildKitchenMonthlySeries = async ({ months = 6, branchMatch = {}, kitchenId }) => {
  const startDate = monthsAgo(months - 1);
  const buckets = lastNMonths(months);
  const aggregation = await SalesInvoice.aggregate([
    { $match: { status: 'active', closedAt: { $gte: startDate }, ...branchMatch } },
    {
      $lookup: {
        from: OrderModel.collection.name,
        localField: 'orderId',
        foreignField: '_id',
        as: 'orderDoc'
      }
    },
    { $unwind: { path: '$orderDoc', preserveNullAndEmptyArrays: false } },
    { $match: { 'orderDoc.kitchenAssigned': kitchenId } },
    {
      $group: {
        _id: {
          year: { $year: '$closedAt' },
          month: { $month: '$closedAt' }
        },
        sales: { $sum: '$grandTotal' },
        orders: { $sum: 1 }
      }
    }
  ]);

  const lookup = new Map(
    aggregation.map((row) => [
      `${row._id.year}-${String(row._id.month).padStart(2, '0')}`,
      { sales: row.sales, orders: row.orders }
    ])
  );

  return buckets.map((bucket) => {
    const data = lookup.get(bucket.key) || { sales: 0, orders: 0 };
    return {
      month: `${bucket.label} ${bucket.year}`,
      sales: data.sales,
      orders: data.orders
    };
  });
};

const buildKitchenDailySeries = async ({ days = 7, branchMatch = {}, kitchenId }) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const buckets = lastNDays(days);
  const aggregation = await SalesInvoice.aggregate([
    { $match: { status: 'active', closedAt: { $gte: startDate }, ...branchMatch } },
    {
      $lookup: {
        from: OrderModel.collection.name,
        localField: 'orderId',
        foreignField: '_id',
        as: 'orderDoc'
      }
    },
    { $unwind: { path: '$orderDoc', preserveNullAndEmptyArrays: false } },
    { $match: { 'orderDoc.kitchenAssigned': kitchenId } },
    {
      $group: {
        _id: {
          year: { $year: '$closedAt' },
          month: { $month: '$closedAt' },
          day: { $dayOfMonth: '$closedAt' }
        },
        sales: { $sum: '$grandTotal' },
        orders: { $sum: 1 }
      }
    }
  ]);

  const lookup = new Map(
    aggregation.map((row) => {
      const key = `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`;
      return [key, { sales: row.sales, orders: row.orders }];
    })
  );

  return buckets.map((bucket) => {
    const data = lookup.get(bucket.key) || { sales: 0, orders: 0 };
    return {
      day: bucket.label,
      sales: data.sales,
      orders: data.orders
    };
  });
};

const resolveNames = async (rows) => {
  const ids = rows.map((row) => row._id).filter(Boolean);
  if (ids.length === 0) return rows;
  const users = await User.find({ _id: { $in: ids } }).select('name');
  const map = new Map(users.map((u) => [u._id.toString(), u.name]));
  return rows.map((row) => ({
    ...row,
    name: map.get(row._id?.toString()) || row.name || 'Unknown'
  }));
};

const buildPerformance = async (months, groupField, branchMatch) => {
  let rows = [];
  if (groupField === 'waiter') {
    rows = await SalesInvoice.aggregate([
      {
        $match: {
          status: 'active',
          closedAt: { $gte: monthsAgo(months) },
          waiterId: { $ne: null },
          ...branchMatch
        }
      },
      {
        $group: {
          _id: '$waiterId',
          name: { $first: '$waiterName' },
          orders: { $sum: 1 },
          sales: { $sum: '$grandTotal' }
        }
      },
      { $sort: { sales: -1 } }
    ]);
  } else {
    rows = await SalesInvoice.aggregate([
      { $match: { status: 'active', closedAt: { $gte: monthsAgo(months) }, ...branchMatch } },
      {
        $lookup: {
          from: OrderModel.collection.name,
          localField: 'orderId',
          foreignField: '_id',
          as: 'orderDoc'
        }
      },
      { $unwind: { path: '$orderDoc', preserveNullAndEmptyArrays: false } },
      { $match: { 'orderDoc.kitchenAssigned': { $ne: null } } },
      {
        $group: {
          _id: '$orderDoc.kitchenAssigned',
          orders: { $sum: 1 },
          sales: { $sum: '$grandTotal' }
        }
      },
      { $sort: { sales: -1 } }
    ]);
  }
  return resolveNames(rows);
};

const loadRoleUsers = async ({ branchId, role }) => {
  if (branchId) {
    const memberships = await UserBranchRole.find({
      branchId,
      role,
      $or: [{ active: true }, { status: 'active' }]
    }).select('userId');
    const ids = [...new Set(memberships.map((m) => m.userId?.toString()).filter(Boolean))];
    if (!ids.length) return [];
    return User.find({ _id: { $in: ids } }).select('name');
  }
  return User.find({ role }).select('name');
};

const buildAnalyticsData = async ({ branchId }) => {
  const match = branchId ? { branchId } : {};
  const totalSalesAgg = await SalesInvoice.aggregate([
    { $match: { status: 'active', ...match } },
    { $group: { _id: null, totalSales: { $sum: '$grandTotal' }, totalOrders: { $sum: 1 } } }
  ]);
  const totalSales = totalSalesAgg[0]?.totalSales || 0;
  const totalOrders = totalSalesAgg[0]?.totalOrders || 0;

  const waiterRankingRaw = await SalesInvoice.aggregate([
    { $match: { status: 'active', waiterId: { $ne: null }, ...match } },
    {
      $group: {
        _id: '$waiterId',
        name: { $first: '$waiterName' },
        orders: { $sum: 1 },
        sales: { $sum: '$grandTotal' },
        tablesBooked: { $sum: 1 }
      }
    },
    { $sort: { sales: -1 } }
  ]);

  const kitchenRankingRaw = await SalesInvoice.aggregate([
    { $match: { status: 'active', ...match } },
    {
      $lookup: {
        from: OrderModel.collection.name,
        localField: 'orderId',
        foreignField: '_id',
        as: 'orderDoc'
      }
    },
    { $unwind: { path: '$orderDoc', preserveNullAndEmptyArrays: false } },
    { $match: { 'orderDoc.kitchenAssigned': { $ne: null } } },
    {
      $group: {
        _id: '$orderDoc.kitchenAssigned',
        orders: { $sum: 1 },
        sales: { $sum: '$grandTotal' },
        tablesBooked: { $sum: 1 }
      }
    },
    { $sort: { sales: -1 } }
  ]);

  const branchMatch = branchId ? { branchId } : {};
  const companyMonthly = await buildMonthlySeries({ months: 6, match: branchMatch });

  const waiterList = await loadRoleUsers({ branchId, role: 'waiter' });
  const kitchenList = await loadRoleUsers({ branchId, role: 'kitchen' });

  const waiterRanking = await resolveNames(waiterRankingRaw);
  const kitchenRanking = await resolveNames(kitchenRankingRaw);

  const waiterMonthly = {};
  for (const waiter of waiterList) {
    waiterMonthly[waiter._id] = await buildMonthlySeries({
      months: 6,
      match: { waiterId: waiter._id, ...branchMatch }
    });
  }

  const kitchenMonthly = {};
  for (const kitchen of kitchenList) {
    kitchenMonthly[kitchen._id] = await buildKitchenMonthlySeries({
      months: 6,
      branchMatch,
      kitchenId: kitchen._id
    });
  }

  const waiterDaily = {};
  for (const waiter of waiterList) {
    waiterDaily[waiter._id] = await buildDailySeries({
      days: 7,
      match: { waiterId: waiter._id, ...branchMatch }
    });
  }

  const kitchenDaily = {};
  for (const kitchen of kitchenList) {
    kitchenDaily[kitchen._id] = await buildKitchenDailySeries({
      days: 7,
      branchMatch,
      kitchenId: kitchen._id
    });
  }

  const waiterPerformance = {
    last1Month: await buildPerformance(1, 'waiter', branchMatch),
    last3Months: await buildPerformance(3, 'waiter', branchMatch),
    last6Months: await buildPerformance(6, 'waiter', branchMatch)
  };

  const kitchenPerformance = {
    last1Month: await buildPerformance(1, 'kitchen', branchMatch),
    last3Months: await buildPerformance(3, 'kitchen', branchMatch),
    last6Months: await buildPerformance(6, 'kitchen', branchMatch)
  };

  return {
    salesSummary: { totalSales, totalOrders },
    companyMonthly,
    waiterRanking,
    kitchenRanking,
    waiterMonthly,
    kitchenMonthly,
    waiterDaily,
    kitchenDaily,
    waiterList,
    kitchenList,
    waiterPerformance,
    kitchenPerformance
  };
};

const analyticsReport = async (req, res) => {
  const cacheKey = `analytics:${req.branchId || 'all'}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return res.json(cached);
  }
  const data = await buildAnalyticsData({ branchId: req.branchId });
  setCache(cacheKey, data, 60 * 1000);
  return res.json(data);
};

module.exports = { summaryReport, overviewReport, analyticsReport, buildSummaryData, buildOverviewData, buildAnalyticsData };
