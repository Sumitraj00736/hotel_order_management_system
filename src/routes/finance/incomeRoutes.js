const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { listIncomes, createIncome, updateIncome, deleteIncome } = require('../../controllers/finance/incomeController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('billing:view'), listIncomes);
router.post(
  '/',
  requirePermission('billing:edit'),
  [
    body('amount').isFloat({ min: 0 }),
    body('accountHead').optional().isString(),
    body('partyType').optional().isIn(['customer', 'staff', 'supplier', 'other']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('txnDate').optional().isISO8601()
  ],
  validate,
  createIncome
);
router.put(
  '/:id',
  requirePermission('billing:edit'),
  [
    param('id').isMongoId(),
    body('amount').optional().isFloat({ min: 0 }),
    body('accountHead').optional().isString(),
    body('partyType').optional().isIn(['customer', 'staff', 'supplier', 'other']),
    body('paymentStatus').optional().isIn(['paid', 'unpaid_credit']),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('txnDate').optional().isISO8601()
  ],
  validate,
  updateIncome
);
router.delete('/:id', requirePermission('billing:edit'), [param('id').isMongoId()], validate, deleteIncome);

module.exports = router;

