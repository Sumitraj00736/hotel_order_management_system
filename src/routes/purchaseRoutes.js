const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listPurchases, createPurchase, updatePurchase, deletePurchase } = require('../controllers/purchaseController');

const router = express.Router();

router.use(auth, branchScope, requireRole('admin'));

router.get('/', listPurchases);
router.post(
  '/',
  [
    body('amount').isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('paidAt').optional().isISO8601(),
    body('items').optional().isArray()
  ],
  validate,
  createPurchase
);
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('amount').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('paidAt').optional().isISO8601(),
    body('items').optional().isArray()
  ],
  validate,
  updatePurchase
);
router.delete('/:id', [param('id').isMongoId()], validate, deletePurchase);

module.exports = router;
