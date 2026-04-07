const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const { listMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('menu:view'), listMenu);
router.get('/:id', requirePermission('menu:view'), getMenuItem);

router.post(
  '/',
  requirePermission('menu:edit'),
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
    body('imageUrl').optional().isURL(),
    body('variants').optional().isArray(),
    body('variants.*.name').optional().isString(),
    body('variants.*.price').optional().isFloat({ min: 0 })
  ],
  validate,
  createMenuItem
);
router.put(
  '/:id',
  requirePermission('menu:edit'),
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
    body('imageUrl').optional().isURL(),
    body('variants').optional().isArray(),
    body('variants.*.name').optional().isString(),
    body('variants.*.price').optional().isFloat({ min: 0 })
  ],
  validate,
  updateMenuItem
);
router.delete('/:id', requirePermission('menu:edit'), deleteMenuItem);

module.exports = router;
