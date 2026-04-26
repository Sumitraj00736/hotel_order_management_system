const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { listPurchases, createPurchase, updatePurchase, deletePurchase } = require('../../controllers/finance/purchaseController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('billing:view'), listPurchases);
router.post(
  '/',
  requirePermission('billing:edit'),
  [
    body('amount').optional().isFloat({ min: 0 }),
    body('billDate').optional().isISO8601(),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('paidAt').optional().isISO8601(),
    body('items').optional().isArray(),
    body('attachments').optional().isArray()
  ],
  validate,
  createPurchase
);
router.put(
  '/:id',
  requirePermission('billing:edit'),
  [
    param('id').isMongoId(),
    body('amount').optional().isFloat({ min: 0 }),
    body('billDate').optional().isISO8601(),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('paidAt').optional().isISO8601(),
    body('items').optional().isArray(),
    body('attachments').optional().isArray()
  ],
  validate,
  updatePurchase
);
router.delete('/:id', requirePermission('billing:edit'), [param('id').isMongoId()], validate, deletePurchase);

module.exports = router;
