const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', listMenu);
router.get('/:id', getMenuItem);

router.post(
  '/',
  requireRole('admin'),
  [
    body('name').notEmpty(),
    body('category').optional().isMongoId(),
    body('subMenu').optional().isMongoId(),
    body('type').optional().isIn(['Veg', 'Non-Veg', 'Vegan', 'Other']),
    body('kotType').optional().isString(),
    body('price').isFloat({ min: 0 }),
    body('maxPrice').optional().isFloat({ min: 0 }),
    body('preparationTimeMinutes').optional().isInt({ min: 0 }),
    body('addOns').optional().isArray(),
    body('imageUrl').optional().isURL()
  ],
  validate,
  createMenuItem
);
router.put(
  '/:id',
  requireRole('admin'),
  [
    body('name').optional().notEmpty(),
    body('category').optional().isMongoId(),
    body('subMenu').optional().isMongoId(),
    body('type').optional().isIn(['Veg', 'Non-Veg', 'Vegan', 'Other']),
    body('kotType').optional().isString(),
    body('price').optional().isFloat({ min: 0 }),
    body('maxPrice').optional().isFloat({ min: 0 }),
    body('preparationTimeMinutes').optional().isInt({ min: 0 }),
    body('addOns').optional().isArray(),
    body('imageUrl').optional().isURL()
  ],
  validate,
  updateMenuItem
);
router.delete('/:id', requireRole('admin'), deleteMenuItem);

module.exports = router;
