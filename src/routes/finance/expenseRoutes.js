const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { listExpenses, createExpense, updateExpense, deleteExpense } = require('../../controllers/finance/expenseController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('billing:view'), listExpenses);
router.post(
  '/',
  requirePermission('billing:edit'),
  [
    body('title').notEmpty(),
    body('amount').isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paidAt').optional().isISO8601()
  ],
  validate,
  createExpense
);
router.put(
  '/:id',
  requirePermission('billing:edit'),
  [
    param('id').isMongoId(),
    body('title').optional().notEmpty(),
    body('amount').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank', 'owner']),
    body('paidAt').optional().isISO8601()
  ],
  validate,
  updateExpense
);
router.delete('/:id', requirePermission('billing:edit'), [param('id').isMongoId()], validate, deleteExpense);

module.exports = router;
