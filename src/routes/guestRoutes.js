const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const MenuItem = require('../models/MenuItem');
const { createGuestOrder, guestStatus } = require('../controllers/guestOrderController');

const router = express.Router();

const guestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/menu', async (req, res) => {
  const items = await MenuItem.find({ isAvailable: true }).sort({ name: 1 });
  res.json(items);
});

router.get('/tables/:tableId/status', [param('tableId').isMongoId()], validate, guestStatus);

router.post(
  '/orders',
  guestLimiter,
  [
    body('table').isMongoId(),
    body('items').isArray({ min: 1 }),
    body('items.*.menuItem').isMongoId(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('guestName').optional().isString().isLength({ max: 80 }),
    body('specialInstructions').optional().isString().isLength({ max: 500 }),
    body('spiceLevel').optional().isIn(['mild', 'medium', 'spicy', 'extra_spicy'])
  ],
  validate,
  createGuestOrder
);

module.exports = router;
