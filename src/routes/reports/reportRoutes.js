const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { summaryReport, overviewReport, analyticsReport } = require('../../controllers/reports/reportController');
const {
  transactionHistory,
  orderDashboard,
  overviewDashboard,
  financeDashboard
} = require('../../controllers/dashboard/dashboardDataController');
const { stockReport } = require('../../controllers/reports/stockReportController');
const { listHistory } = require('../../controllers/reports/historyController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/summary', requirePermission('reports:view'), summaryReport);
router.get('/overview', requirePermission('reports:view'), overviewReport);
router.get('/analytics', requirePermission('reports:view'), analyticsReport);
router.get('/history', requirePermission('reports:view'), listHistory);
router.get('/stock', requirePermission('reports:view'), stockReport);
router.get('/transactions', requirePermission('reports:view'), transactionHistory);
router.get('/order-dashboard', requirePermission('reports:view'), orderDashboard);
router.get('/overview-dashboard', requirePermission('reports:view'), overviewDashboard);
router.get('/finance-dashboard', requirePermission('reports:view'), financeDashboard);

module.exports = router;
