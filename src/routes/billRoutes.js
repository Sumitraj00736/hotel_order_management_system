const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { generateBill, payBill } = require('../controllers/billController');

const router = express.Router();

router.use(auth, branchScope, requireRole('admin', 'waiter'));

router.get('/:id', generateBill);
router.post(
  '/:id/pay',
  requireRole('admin'),
  [body('paymentMethod').isIn(['cash', 'fonepay', 'card', 'bank'])],
  validate,
  payBill
);

module.exports = router;
