const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const {
  listPurchaseReturns,
  createPurchaseReturn,
  updatePurchaseReturn,
  deletePurchaseReturn
} = require('../../controllers/finance/purchaseReturnController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('billing:view'), listPurchaseReturns);
router.post(
  '/',
  requirePermission('billing:edit'),
  [
    body('totalAmount').optional().isFloat({ min: 0 }),
    body('billDate').optional().isISO8601(),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('items').optional().isArray(),
    body('attachments').optional().isArray()
  ],
  validate,
  createPurchaseReturn
);
router.put(
  '/:id',
  requirePermission('billing:edit'),
  [
    param('id').isMongoId(),
    body('totalAmount').optional().isFloat({ min: 0 }),
    body('billDate').optional().isISO8601(),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('items').optional().isArray(),
    body('attachments').optional().isArray()
  ],
  validate,
  updatePurchaseReturn
);
router.delete('/:id', requirePermission('billing:edit'), [param('id').isMongoId()], validate, deletePurchaseReturn);

module.exports = router;

