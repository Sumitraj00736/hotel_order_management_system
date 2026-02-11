const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { summaryReport } = require('../controllers/reportController');
const { listHistory } = require('../controllers/historyController');

const router = express.Router();

router.use(auth, requireRole('admin'));

router.get('/summary', summaryReport);
router.get('/history', listHistory);

module.exports = router;
