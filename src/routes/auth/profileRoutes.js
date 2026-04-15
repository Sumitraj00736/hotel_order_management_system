const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { getProfile, getWaiterAnalytics } = require('../../controllers/auth/profileController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/me', getProfile);
router.get('/waiter/analytics', requirePermission('orders:view'), getWaiterAnalytics);

module.exports = router;
