const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const { generateBill, payBill } = require('../../controllers/orders/billController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/:id', requirePermission('orders:checkout:view', 'orders:view'), generateBill);
router.post(
  '/:id/pay',
  requirePermission('orders:checkout:edit', 'orders:edit'),
  [body('paymentMethod').isIn(['cash', 'fonepay', 'card', 'bank'])],
  validate,
  payBill
);

module.exports = router;
