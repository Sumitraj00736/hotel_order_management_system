const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const { getProfile, getWaiterAnalytics } = require('../controllers/profileController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/me', getProfile);
router.get('/waiter/analytics', requireRole('waiter'), getWaiterAnalytics);

module.exports = router;
