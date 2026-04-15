const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { dashboardSnapshot } = require('../../controllers/dashboard/dashboardController');

const router = express.Router();

router.use(auth, branchScope);
router.get('/', requirePermission('dashboard:view'), dashboardSnapshot);

module.exports = router;
