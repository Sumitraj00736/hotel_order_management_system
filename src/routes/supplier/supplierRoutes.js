const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierLedger
} = require('../../controllers/supplier/supplierController');

router.use(auth, branchScope);

router.get('/', listSuppliers);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);
router.get('/:id/ledger', getSupplierLedger);

module.exports = router;
