const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const {
  listIngredients,
  createIngredient,
  updateIngredient,
  restockIngredient,
  listTransactions,
  setRecipe,
  getRecipe,
  listRecipes
} = require('../controllers/inventoryController');

const router = express.Router();

router.use(auth, requireRole('admin'));

router.get('/ingredients', listIngredients);
router.post(
  '/ingredients',
  [
    body('name').notEmpty(),
    body('unit').notEmpty(),
    body('currentStock').optional().isFloat({ min: 0 }),
    body('reorderLevel').optional().isFloat({ min: 0 })
  ],
  validate,
  createIngredient
);
router.put(
  '/ingredients/:id',
  [
    param('id').isMongoId(),
    body('currentStock').optional().isFloat({ min: 0 }),
    body('reorderLevel').optional().isFloat({ min: 0 })
  ],
  validate,
  updateIngredient
);
router.post(
  '/ingredients/:id/restock',
  [param('id').isMongoId(), body('amount').isFloat({ min: 0.01 })],
  validate,
  restockIngredient
);

router.get('/transactions', listTransactions);

router.post(
  '/recipes',
  [
    body('menuItem').isMongoId(),
    body('ingredients').isArray({ min: 1 }),
    body('ingredients.*.ingredient').isMongoId(),
    body('ingredients.*.quantity').isFloat({ min: 0.001 })
  ],
  validate,
  setRecipe
);

router.get('/recipes/:menuItem', [param('menuItem').isMongoId()], validate, getRecipe);
router.get('/recipes', listRecipes);

module.exports = router;
