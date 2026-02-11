const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listOrders, getOrder, createOrder, updateOrder, updateOrderStatus } = require('../controllers/orderController');

const router = express.Router();

router.use(auth);

router.get('/', listOrders);
router.get('/:id', getOrder);

router.post(
  '/',
  requireRole('admin', 'waiter'),
  [
    body('table').notEmpty(),
    body('items').isArray({ min: 1 }),
    body('items.*.menuItem').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 })
  ],
  validate,
  createOrder
);

router.put(
  '/:id',
  requireRole('admin', 'waiter'),
  [
    body('table').optional().notEmpty(),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.menuItem').optional().notEmpty(),
    body('items.*.quantity').optional().isInt({ min: 1 })
  ],
  validate,
  updateOrder
);

router.patch(
  '/:id/status',
  requireRole('admin', 'kitchen'),
  [body('status').isIn(['pending', 'preparing', 'ready', 'served'])],
  validate,
  updateOrderStatus
);

module.exports = router;
