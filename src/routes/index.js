const routeDefinitions = [
  { path: '/api/auth', router: require('./auth/authRoutes') },
  { path: '/api/profile', router: require('./auth/profileRoutes') },
  { path: '/api/users', router: require('./users/userRoutes') },
  { path: '/api/roles', router: require('./users/roleRoutes') },
  { path: '/api/departments', router: require('./users/departmentRoutes') },
  { path: '/api/orders', router: require('./orders/orderRoutes') },
  { path: '/api/bills', router: require('./orders/billRoutes') },
  { path: '/api/guest', router: require('./orders/guestRoutes') },
  { path: '/api/menus', router: require('./menu/menuRoutes') },
  { path: '/api/categories', router: require('./menu/categoryRoutes') },
  { path: '/api/submenus', router: require('./menu/subMenuRoutes') },
  { path: '/api/addons', router: require('./menu/addOnRoutes') },
  { path: '/api/combos', router: require('./menu/comboRoutes') },
  { path: '/api/tables', router: require('./tables/tableRoutes') },
  { path: '/api/spaces', router: require('./tables/spaceRoutes') },
  { path: '/api/qr-codes', router: require('./tables/qrCodeRoutes') },
  { path: '/api/customers', router: require('./customers/customerRoutes') },
  { path: '/api/inventory', router: require('./inventory/inventoryRoutes') },
  { path: '/api/taxes', router: require('./finance/taxRoutes') },
  { path: '/api/purchases', router: require('./finance/purchaseRoutes') },
  { path: '/api/expenses', router: require('./finance/expenseRoutes') },
  { path: '/api/billing', router: require('./finance/billingRoutes') },
  { path: '/api/reports', router: require('./reports/reportRoutes') },
  { path: '/api/dashboard', router: require('./dashboard/dashboardRoutes') },
  { path: '/api/notifications', router: require('./notifications/notificationRoutes') },
  { path: '/api/push', router: require('./notifications/pushRoutes') },
  { path: '/api/activity-logs', router: require('./notifications/activityLogRoutes') },
  { path: '/api/promotions', router: require('./notifications/promotionRoutes') },
  { path: '/api/settings', router: require('./settings/settingsRoutes') },
  { path: '/api/support', router: require('./support/supportRoutes') },
  { path: '/api/public', router: require('./public/publicRoutes') }
];

const registerApiRoutes = (app) => {
  routeDefinitions.forEach(({ path, router }) => {
    app.use(path, router);
  });
};

module.exports = {
  registerApiRoutes,
  routeDefinitions
};
