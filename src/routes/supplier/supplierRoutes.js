const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger
} = require('../../controllers/supplier/supplierController');

router.use(auth, branchScope);

router.get('/', requirePermission('suppliers:view'), listSuppliers);
router.post('/', requirePermission('suppliers:edit'), createSupplier);
router.put('/:id', requirePermission('suppliers:edit'), updateSupplier);
router.delete('/:id', requirePermission('suppliers:edit'), deleteSupplier);
router.get('/:id/ledger', requirePermission('suppliers:view'), getSupplierLedger);

module.exports = router;
