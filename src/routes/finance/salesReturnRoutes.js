const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const {
  listSalesReturns,
  createSalesReturn,
  updateSalesReturn,
  deleteSalesReturn
} = require('../../controllers/finance/salesReturnController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('billing:view'), listSalesReturns);
router.post(
  '/',
  requirePermission('billing:edit'),
  [
    body('txnDate').optional().isISO8601(),
    body('totalAmount').optional().isFloat({ min: 0 }),
    body('netAmount').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('items').optional().isArray(),
    body('attachments').optional().isArray()
  ],
  validate,
  createSalesReturn
);
router.put(
  '/:id',
  requirePermission('billing:edit'),
  [
    param('id').isMongoId(),
    body('txnDate').optional().isISO8601(),
    body('totalAmount').optional().isFloat({ min: 0 }),
    body('netAmount').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('items').optional().isArray(),
    body('attachments').optional().isArray()
  ],
  validate,
  updateSalesReturn
);
router.delete('/:id', requirePermission('billing:edit'), [param('id').isMongoId()], validate, deleteSalesReturn);

module.exports = router;

