const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listExpenses, createExpense, updateExpense, deleteExpense } = require('../controllers/expenseController');

const router = express.Router();

router.use(auth, branchScope, requireRole('admin'));

router.get('/', listExpenses);
router.post(
  '/',
  [
    body('title').notEmpty(),
    body('amount').isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('paidAt').optional().isISO8601()
  ],
  validate,
  createExpense
);
router.put(
  '/:id',
  [
    param('id').isMongoId(),
    body('title').optional().notEmpty(),
    body('amount').optional().isFloat({ min: 0 }),
    body('paymentMethod').optional().isIn(['cash', 'fonepay', 'card', 'bank']),
    body('paidAt').optional().isISO8601()
  ],
  validate,
  updateExpense
);
router.delete('/:id', [param('id').isMongoId()], validate, deleteExpense);

module.exports = router;
