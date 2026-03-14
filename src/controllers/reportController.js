const Order = require('../models/Order');
const CustomerHistory = require('../models/CustomerHistory');
const User = require('../models/User');

const summaryReport = async (req, res) => {
  const orders = await Order.find();
  const totalOrders = orders.length;
  const totalSales = orders.filter((o) => o.status === 'paid').reduce((sum, o) => sum + o.totalAmount, 0);
  const byStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});

  return res.json({ totalOrders, totalSales, byStatus });
};

const overviewReport = async (req, res) => {
  const activeOrders = await Order.find({ status: { $in: ['pending', 'preparing', 'ready', 'served'] } })
    .populate('table')
    .populate('createdBy', 'name email')
    .populate('kitchenAssigned', 'name email');

  const unpaidOrders = await Order.countDocuments({ status: { $ne: 'paid' } });
  const statusCountsAgg = await Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
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

  return res.json({
    activeByWaiter: waiterList,
    activeOrders: activeOrders.length,
    unpaidOrders,
    statusCounts,
    kitchenLoads,
    topWaiter,
    topKitchen
  });
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

const buildPerformance = async (months, groupField) => {
  const fieldId = `$${groupField}.id`;
  const fieldName = `$${groupField}.name`;
  const match = {
    paidAt: { $gte: monthsAgo(months) },
    [groupField + '.id']: { $ne: null }
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

const analyticsReport = async (req, res) => {
  const totalSalesAgg = await CustomerHistory.aggregate([
    { $group: { _id: null, totalSales: { $sum: '$totalAmount' }, totalOrders: { $sum: 1 } } }
  ]);
  const totalSales = totalSalesAgg[0]?.totalSales || 0;
  const totalOrders = totalSalesAgg[0]?.totalOrders || 0;

  const waiterRankingRaw = await CustomerHistory.aggregate([
    { $match: { 'waiter.id': { $ne: null } } },
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
    { $match: { 'kitchen.id': { $ne: null } } },
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

  const companyMonthly = await buildMonthlySeries({ months: 6 });

  const waiterList = await User.find({ role: 'waiter' }).select('name');
  const kitchenList = await User.find({ role: 'kitchen' }).select('name');

  const waiterRanking = await resolveNames(waiterRankingRaw);
  const kitchenRanking = await resolveNames(kitchenRankingRaw);

  const waiterMonthly = {};
  for (const waiter of waiterList) {
    waiterMonthly[waiter._id] = await buildMonthlySeries({
      months: 6,
      match: { 'waiter.id': waiter._id }
    });
  }

  const kitchenMonthly = {};
  for (const kitchen of kitchenList) {
    kitchenMonthly[kitchen._id] = await buildMonthlySeries({
      months: 6,
      match: { 'kitchen.id': kitchen._id }
    });
  }

  const waiterDaily = {};
  for (const waiter of waiterList) {
    waiterDaily[waiter._id] = await buildDailySeries({
      days: 7,
      match: { 'waiter.id': waiter._id }
    });
  }

  const kitchenDaily = {};
  for (const kitchen of kitchenList) {
    kitchenDaily[kitchen._id] = await buildDailySeries({
      days: 7,
      match: { 'kitchen.id': kitchen._id }
    });
  }

  const waiterPerformance = {
    last1Month: await buildPerformance(1, 'waiter'),
    last3Months: await buildPerformance(3, 'waiter'),
    last6Months: await buildPerformance(6, 'waiter')
  };

  const kitchenPerformance = {
    last1Month: await buildPerformance(1, 'kitchen'),
    last3Months: await buildPerformance(3, 'kitchen'),
    last6Months: await buildPerformance(6, 'kitchen')
  };

  return res.json({
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
  });
};

module.exports = { summaryReport, overviewReport, analyticsReport };
