const User = require('../../models/users/User');
const UserBranchRole = require('../../models/users/UserBranchRole');
const Table = require('../../models/tables/Table');
const MenuItem = require('../../models/menu/MenuItem');
const Order = require('../../models/orders/Order');
const Category = require('../../models/menu/Category');
const SubMenu = require('../../models/menu/SubMenu');
const AddOn = require('../../models/menu/AddOn');
const ComboOffer = require('../../models/menu/ComboOffer');
const Purchase = require('../../models/finance/Purchase');
const Expense = require('../../models/finance/Expense');
const Notification = require('../../models/notifications/Notification');
const { buildSummaryData, buildOverviewData, buildAnalyticsData } = require('../reports/reportController');
const { buildStockReport } = require('../reports/stockReportController');
const { fetchHistory } = require('../reports/historyController');
const { getCache, setCache } = require('../../utils/performance/cache');

const getStockRange = (fromQuery, toQuery) => {
  const now = new Date();
  const to = toQuery ? new Date(toQuery) : now;
  const from = fromQuery ? new Date(fromQuery) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
};

const dashboardSnapshot = async (req, res) => {
  try {
    const branchId = req.branchId;
    const ordersLimit = Math.min(Math.max(Number(req.query.ordersLimit) || 50, 1), 200);
    const includeAnalytics = req.query.includeAnalytics !== 'false';
    const includeStock = req.query.includeStock !== 'false';
    const includeHistory = req.query.includeHistory !== 'false';
    const includeNotifications = req.query.includeNotifications !== 'false';
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    const orderFilter = {};
    if (branchId) orderFilter.branchId = branchId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    orderFilter.createdAt = { $gte: dateFrom ? new Date(dateFrom) : todayStart };
    if (dateTo) orderFilter.createdAt.$lte = new Date(dateTo);

    const ordersQuery = Order.find(orderFilter)
      .populate('table')
      .populate('items.menuItem')
      .populate('createdBy', 'name email role')
      .populate('kitchenAssigned', 'name email role')
      .populate('assignedStaff', 'name email role')
      .populate('paidBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(ordersLimit);

    const summaryPromise = buildSummaryData({ branchId, dateFrom, dateTo });
    const overviewPromise = buildOverviewData({ branchId });

    const analyticsCacheKey = `analytics:${branchId || 'all'}`;
    const cachedAnalytics = includeAnalytics ? getCache(analyticsCacheKey) : null;
    const analyticsPromise = includeAnalytics ? cachedAnalytics || buildAnalyticsData({ branchId }) : Promise.resolve(null);

    const stockPromise = includeStock
      ? (() => {
          const { from, to } = getStockRange(req.query.stockFrom, req.query.stockTo);
          return buildStockReport({ branchId, from, to, top: 10, limit: 200 });
        })()
      : Promise.resolve(null);

    const historyPromise = includeHistory
      ? fetchHistory({ branchId, limit: 100 })
      : Promise.resolve([]);

    const notificationsPromise = includeNotifications
      ? Notification.find({ ...(branchId ? { branchId } : {}), role: 'admin' })
          .sort({ createdAt: -1 })
          .limit(50)
      : Promise.resolve([]);

    const menusCacheKey = `menus_v2:${branchId || 'all'}:all:all:`;
    const cachedMenus = getCache(menusCacheKey);

    const membershipsPromise = branchId
      ? UserBranchRole.find({ branchId }).populate('userId')
      : Promise.resolve([]);

    const [
      memberships,
      tables,
      menus,
      orders,
      summary,
      overview,
      analytics,
      stock,
      history,
      categories,
      submenus,
      addons,
      combos,
      purchases,
      expenses,
      notifications
    ] = await Promise.all([
      membershipsPromise,
      Table.find(branchId ? { branchId } : {}).sort({ tableNumber: 1 }),
      cachedMenus || 
      MenuItem.find(branchId ? { branchId } : {})
        .populate('category', 'name')
        .populate('subMenu', 'name')
        .sort({ name: 1 }),
      ordersQuery,
      summaryPromise,
      overviewPromise,
      analyticsPromise,
      stockPromise,
      historyPromise,
      Category.find(branchId ? { branchId } : {}).sort({ name: 1 }),
      SubMenu.find(branchId ? { branchId } : {}).sort({ name: 1 }),
      AddOn.find(branchId ? { branchId } : {}).sort({ name: 1 }),
      ComboOffer.find(branchId ? { branchId } : {}).sort({ name: 1 }),
      Purchase.find(branchId ? { branchId } : {}).sort({ paidAt: -1 }).limit(200),
      Expense.find(branchId ? { branchId } : {}).sort({ paidAt: -1 }).limit(200),
      notificationsPromise
    ]);

    if (!cachedMenus && Array.isArray(menus)) {
      setCache(menusCacheKey, menus, 10 * 60 * 1000);
    }
    if (includeAnalytics && !cachedAnalytics) {
      setCache(analyticsCacheKey, analytics, 60 * 1000);
    }

    let users = memberships
      .map((m) => {
        const u = m.userId;
        if (!u) return null;
        
        // Ensure owners have correct effective status and role in snapshot
        const effectiveStatus = m.status || (m.isOwner ? 'active' : (m.active ? 'active' : 'inactive'));

        return {
          _id: u._id,
          id: u._id,
          name: u.name || u.email?.split('@')[0] || 'User',
          email: u.email,
          phone: u.phone,
          role: m.role || (m.isOwner ? 'superadmin' : u.role),
          status: effectiveStatus,
          dateOfJoining: u.dateOfJoining,
          salary: u.salary,
          shiftStart: u.shiftStart,
          shiftEnd: u.shiftEnd
        };
      })
      .filter(Boolean);

    // Fail-safe: Ensure the current logged-in user (usually the owner) is present in the users list
    if (users.length === 0 && req.user) {
      users.push({
        _id: req.user._id,
        id: req.user._id,
        name: req.user.name || req.user.email?.split('@')[0] || 'Admin',
        email: req.user.email,
        role: 'superadmin',
        isOwner: true,
        status: 'active'
      });
    }

    return res.json({
      users,
      tables,
      menus,
      orders,
      report: summary,
      overview,
      analytics,
      stockReport: stock,
      history,
      categories,
      submenus,
      addons,
      combos,
      purchases,
      expenses,
      notifications,
      meta: {
        orders: {
          limit: ordersLimit,
          from: orderFilter.createdAt?.$gte || null,
          to: orderFilter.createdAt?.$lte || null
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Dashboard snapshot failed', error: error.message });
  }
};

module.exports = { dashboardSnapshot };
