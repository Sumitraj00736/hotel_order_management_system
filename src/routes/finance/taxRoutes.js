const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { listTaxes, createTax, updateTax, deleteTax } = require('../../controllers/finance/taxController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('settings:view'), listTaxes);
router.post('/', requirePermission('settings:edit'), createTax);
router.put('/:id', requirePermission('settings:edit'), updateTax);
router.delete('/:id', requirePermission('settings:edit'), deleteTax);

module.exports = router;
