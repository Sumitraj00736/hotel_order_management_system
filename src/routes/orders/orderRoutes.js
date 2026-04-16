const express = require('express');
const { body } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { listOrders, getOrder, createOrder, updateOrder, updateOrderStatus } = require('../../controllers/orders/orderController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('orders:view'), listOrders);
router.get('/:id', requirePermission('orders:view'), getOrder);

router.post(
  '/',
  requirePermission('orders:edit'),
  [
    body('table').optional({ checkFalsy: true }).isMongoId(),
    body('items').isArray({ min: 1 }),
    body('items.*.menuItem').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.isComplimentary').optional().isBoolean(),
    body('items.*.variantId').optional().isMongoId(),
    body('items.*.variantName').optional().isString(),
    body('items.*.variantPrice').optional().isFloat({ min: 0 }),
    body('items.*.itemNote').optional().isString().isLength({ max: 500 }),
    body('orderType').optional().isIn(['dine_in', 'takeaway', 'delivery', 'online', 'staff']),
    body('customerId').optional({ checkFalsy: true }).isMongoId(),
    body('staffId').optional({ checkFalsy: true }).isMongoId(),
    body('customerName').optional().isString().isLength({ max: 200 }),
    body('spiceLevel').optional().isIn(['mild', 'medium', 'spicy', 'extra_spicy']),
    body('specialInstructions').optional().isString().isLength({ max: 500 })
  ],
  validate,
  createOrder
);

router.put(
  '/:id',
  requirePermission('orders:edit'),
  [
    body('table').optional().notEmpty(),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.menuItem').optional().notEmpty(),
    body('items.*.quantity').optional().isInt({ min: 1 }),
    body('items.*.isComplimentary').optional().isBoolean(),
    body('items.*.variantId').optional().isMongoId(),
    body('items.*.variantName').optional().isString(),
    body('items.*.variantPrice').optional().isFloat({ min: 0 }),
    body('items.*.itemNote').optional().isString().isLength({ max: 500 }),
    body('spiceLevel').optional().isIn(['mild', 'medium', 'spicy', 'extra_spicy']),
    body('specialInstructions').optional().isString().isLength({ max: 500 })
  ],
  validate,
  updateOrder
);

router.patch(
  '/:id/status',
  requirePermission('orders:edit'),
  [body('status').isIn(['pending', 'preparing', 'ready', 'served'])],
  validate,
  updateOrderStatus
);

module.exports = router;
