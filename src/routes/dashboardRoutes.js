const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const { dashboardSnapshot } = require('../controllers/dashboardController');

const router = express.Router();

router.use(auth, branchScope, requireRole('admin'));
router.get('/', dashboardSnapshot);

module.exports = router;
