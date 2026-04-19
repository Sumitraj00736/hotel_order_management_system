const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const {
  listPayments,
  createPayment,
  updatePayment,
  deletePayment
} = require('../../controllers/finance/paymentController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('billing:view'), listPayments);
router.post(
  '/',
  requirePermission('billing:edit'),
  [
    body('direction').isIn(['in', 'out']),
    body('amount').isFloat({ min: 0 }),
    body('txnDate').optional().isISO8601(),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('partyType').optional().isIn(['customer', 'staff', 'supplier', 'other']),
    body('attachments').optional().isArray()
  ],
  validate,
  createPayment
);
router.put(
  '/:id',
  requirePermission('billing:edit'),
  [
    param('id').isMongoId(),
    body('direction').optional().isIn(['in', 'out']),
    body('amount').optional().isFloat({ min: 0 }),
    body('txnDate').optional().isISO8601(),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('partyType').optional().isIn(['customer', 'staff', 'supplier', 'other']),
    body('attachments').optional().isArray()
  ],
  validate,
  updatePayment
);
router.delete('/:id', requirePermission('billing:edit'), [param('id').isMongoId()], validate, deletePayment);

module.exports = router;

