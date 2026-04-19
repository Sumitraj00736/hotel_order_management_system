const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { listSalesInvoices } = require('../../controllers/finance/salesInvoiceController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('billing:view'), listSalesInvoices);

module.exports = router;
