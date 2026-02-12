const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { getProfile, getWaiterAnalytics } = require('../controllers/profileController');

const router = express.Router();

router.use(auth);

router.get('/me', getProfile);
router.get('/waiter/analytics', requireRole('waiter'), getWaiterAnalytics);

module.exports = router;
