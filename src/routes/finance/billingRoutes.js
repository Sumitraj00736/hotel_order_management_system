const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { getBillingSummary } = require('../../controllers/finance/billingController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/summary', requirePermission('billing:view'), getBillingSummary);

module.exports = router;
