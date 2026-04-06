const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const { summaryReport, overviewReport, analyticsReport } = require('../controllers/reportController');
const {
  transactionHistory,
  orderDashboard,
  overviewDashboard,
  financeDashboard
} = require('../controllers/dashboardDataController');
const { stockReport } = require('../controllers/stockReportController');
const { listHistory } = require('../controllers/historyController');

const router = express.Router();

router.use(auth, branchScope, requireRole('admin'));

router.get('/summary', summaryReport);
router.get('/overview', overviewReport);
router.get('/analytics', analyticsReport);
router.get('/history', listHistory);
router.get('/stock', stockReport);
router.get('/transactions', transactionHistory);
router.get('/order-dashboard', orderDashboard);
router.get('/overview-dashboard', overviewDashboard);
router.get('/finance-dashboard', financeDashboard);

module.exports = router;
