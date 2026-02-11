const express = require('express');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { generateBill, payBill } = require('../controllers/billController');

const router = express.Router();

router.use(auth, requireRole('admin', 'waiter'));

router.get('/:id', generateBill);
router.post(
  '/:id/pay',
  requireRole('admin'),
  [body('paymentMethod').isIn(['cash', 'fonepay'])],
  validate,
  payBill
);

module.exports = router;
