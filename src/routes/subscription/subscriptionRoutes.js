const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const { getMySubscription } = require('../../controllers/subscription/subscriptionController');

const router = express.Router();

router.use(auth, branchScope);

// GET /api/subscription/my — returns plan, limits & live usage for the current branch
router.get('/my', getMySubscription);

module.exports = router;
