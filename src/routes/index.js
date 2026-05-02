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
  { path: '/api/table-types', router: require('./tables/tableTypeRoutes') },
  { path: '/api/spaces', router: require('./tables/spaceRoutes') },
  { path: '/api/qr-codes', router: require('./tables/qrCodeRoutes') },
  { path: '/api/customers', router: require('./customers/customerRoutes') },
  { path: '/api/inventory', router: require('./inventory/inventoryRoutes') },
  { path: '/api/suppliers', router: require('./supplier/supplierRoutes') },
  { path: '/api/taxes', router: require('./finance/taxRoutes') },
  { path: '/api/daybook', router: require('./finance/daybookRoutes') },
  { path: '/api/purchases', router: require('./finance/purchaseRoutes') },
  { path: '/api/purchase-returns', router: require('./finance/purchaseReturnRoutes') },
  { path: '/api/incomes', router: require('./finance/incomeRoutes') },
  { path: '/api/expenses', router: require('./finance/expenseRoutes') },
  { path: '/api/sales-returns', router: require('./finance/salesReturnRoutes') },
  { path: '/api/payments', router: require('./finance/paymentRoutes') },
  { path: '/api/finance/sales-invoices', router: require('./finance/salesInvoiceRoutes') },
  { path: '/api/billing', router: require('./finance/billingRoutes') },
  { path: '/api/reports', router: require('./reports/reportRoutes') },
  { path: '/api/dashboard', router: require('./dashboard/dashboardRoutes') },
  { path: '/api/notifications', router: require('./notifications/notificationRoutes') },
  { path: '/api/push', router: require('./notifications/pushRoutes') },
  { path: '/api/activity-logs', router: require('./notifications/activityLogRoutes') },
  { path: '/api/promotions', router: require('./notifications/promotionRoutes') },
  { path: '/api/settings', router: require('./settings/settingsRoutes') },
  { path: '/api/branches', router: require('./core/branchRoutes') },
  { path: '/api/support', router: require('./support/supportRoutes') },
  { path: '/api/public', router: require('./public/publicRoutes') },
  { path: '/api/subscription', router: require('./subscription/subscriptionRoutes') },
  { path: '/api/platform/control', router: require('./platform/honorAdminRoutes') },
  { path: '/api/platform/auth', router: require('./platform/platformAuthRoutes') }
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
