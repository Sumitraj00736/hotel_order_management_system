const Order = require('../../models/orders/Order');
const CustomerHistory = require('../../models/customers/CustomerHistory');
const User = require('../../models/users/User');
const Purchase = require('../../models/finance/Purchase');
const Expense = require('../../models/finance/Expense');
const { getCache, setCache } = require('../../utils/cache');

const buildSummaryData = async ({ branchId, dateFrom, dateTo }) => {
  const filter = {};
  if (branchId) filter.branchId = branchId;
  const hasDateFilter = Boolean(dateFrom || dateTo);

  const totalOrders = await Order.countDocuments(filter);

  const paidMatch = {
    ...filter,
    $or: [{ status: 'paid' }, { paymentStatus: 'paid' }]
  };
  if (hasDateFilter) {
    paidMatch.paidAt = {};
    if (dateFrom) paidMatch.paidAt.$gte = new Date(dateFrom);
    if (dateTo) paidMatch.paidAt.$lte = new Date(dateTo);
  }

  const paidAgg = await Order.aggregate([
    { $match: paidMatch },
    {
      $group: {
        _id: null,
        totalSales: { $sum: { $ifNull: ['$finalAmount', '$totalAmount'] } },
        dineIn: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'dine_in'] }, { $ifNull: ['$finalAmount', '$totalAmount'] }, 0]
          }
        },
        delivery: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'delivery'] }, { $ifNull: ['$finalAmount', '$totalAmount'] }, 0]
          }
        },
        takeaway: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'takeaway'] }, { $ifNull: ['$finalAmount', '$totalAmount'] }, 0]
          }
        },
        reservation: {
          $sum: {
            $cond: [{ $eq: ['$orderType', 'online'] }, { $ifNull: ['$finalAmount', '$totalAmount'] }, 0]
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

  const totalSales = paidAgg[0]?.totalSales || 0;
  const unpaidTotal = unpaidAgg[0]?.total || 0;
  const typeTotals = {
    dineIn: paidAgg[0]?.dineIn || 0,
    delivery: paidAgg[0]?.delivery || 0,
    takeaway: paidAgg[0]?.takeaway || 0,
    reservation: paidAgg[0]?.reservation || 0
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
    { $match: purchaseMatch },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const expenseAgg = await Expense.aggregate([
    { $match: expenseMatch },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  const purchase = purchaseAgg[0]?.total || 0;
  const expenses = expenseAgg[0]?.total || 0;
  const paymentIn = totalSales;
  const paymentOut = purchase + expenses;
  const income = paymentIn; // keep aligned with sales unless other income sources are added

  return {
    totalOrders,
    totalSales,
    byStatus,
    paid: totalSales,
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
  const aggregation = await CustomerHistory.aggregate([
    { $match: { paidAt: { $gte: startDate }, ...match } },
    {
      $group: {
        _id: {
          year: { $year: '$paidAt' },
          month: { $month: '$paidAt' }
        },
        sales: { $sum: '$totalAmount' },
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
  const aggregation = await CustomerHistory.aggregate([
    { $match: { paidAt: { $gte: startDate }, ...match } },
    {
      $group: {
        _id: {
          year: { $year: '$paidAt' },
          month: { $month: '$paidAt' },
          day: { $dayOfMonth: '$paidAt' }
        },
        sales: { $sum: '$totalAmount' },
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
  const fieldId = `$${groupField}.id`;
  const fieldName = `$${groupField}.name`;
  const match = {
    paidAt: { $gte: monthsAgo(months) },
    [groupField + '.id']: { $ne: null },
    ...branchMatch
  };

  const rows = await CustomerHistory.aggregate([
    { $match: match },
    {
      $group: {
        _id: fieldId,
        name: { $first: fieldName },
        orders: { $sum: 1 },
        sales: { $sum: '$totalAmount' }
      }
    },
    { $sort: { sales: -1 } }
  ]);
  return resolveNames(rows);
};

const buildAnalyticsData = async ({ branchId }) => {
  const match = branchId ? { branchId } : {};
  const totalSalesAgg = await CustomerHistory.aggregate([
    { $match: match },
    { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } }
  ]);
  const totalSales = totalSalesAgg[0]?.totalSales || 0;
  const totalOrders = totalSalesAgg[0]?.totalOrders || 0;

  const waiterRankingRaw = await CustomerHistory.aggregate([
    { $match: { 'waiter.id': { $ne: null }, ...match } },
    {
      $group: {
        _id: '$waiter.id',
        name: { $first: '$waiter.name' },
        orders: { $sum: 1 },
        sales: { $sum: '$totalAmount' },
        tablesBooked: { $sum: 1 }
      }
    },
    { $sort: { sales: -1 } }
  ]);

  const kitchenRankingRaw = await CustomerHistory.aggregate([
    { $match: { 'kitchen.id': { $ne: null }, ...match } },
    {
      $group: {
        _id: '$kitchen.id',
        name: { $first: '$kitchen.name' },
        orders: { $sum: 1 },
        sales: { $sum: '$totalAmount' },
        tablesBooked: { $sum: 1 }
      }
    },
    { $sort: { sales: -1 } }
  ]);

  const branchMatch = branchId ? { branchId } : {};
  const companyMonthly = await buildMonthlySeries({ months: 6, match: branchMatch });

  const waiterList = await User.find({ role: 'waiter', ...(branchId ? { branchId } : {}) }).select('name');
  const kitchenList = await User.find({ role: 'kitchen', ...(branchId ? { branchId } : {}) }).select('name');

  const waiterRanking = await resolveNames(waiterRankingRaw);
  const kitchenRanking = await resolveNames(kitchenRankingRaw);

  const waiterMonthly = {};
  for (const waiter of waiterList) {
    waiterMonthly[waiter._id] = await buildMonthlySeries({
      months: 6,
      match: { 'waiter.id': waiter._id, ...branchMatch }
    });
  }

  const kitchenMonthly = {};
  for (const kitchen of kitchenList) {
    kitchenMonthly[kitchen._id] = await buildMonthlySeries({
      months: 6,
      match: { 'kitchen.id': kitchen._id, ...branchMatch }
    });
  }

  const waiterDaily = {};
  for (const waiter of waiterList) {
    waiterDaily[waiter._id] = await buildDailySeries({
      days: 7,
      match: { 'waiter.id': waiter._id, ...branchMatch }
    });
  }

  const kitchenDaily = {};
  for (const kitchen of kitchenList) {
    kitchenDaily[kitchen._id] = await buildDailySeries({
      days: 7,
      match: { 'kitchen.id': kitchen._id, ...branchMatch }
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
