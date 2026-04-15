const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const {
  listIngredients,
  listIngredientUnits,
  createIngredientUnit,
  updateIngredientUnit,
  deleteIngredientUnit,
  createIngredient,
  updateIngredient,
  restockIngredient,
  listTransactions,
  setRecipe,
  getRecipe,
  listRecipes,
  deleteIngredient,
  deleteRecipe
} = require('../../controllers/inventory/inventoryController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/ingredients', requirePermission('inventory:view'), listIngredients);
router.get('/ingredient-units', requirePermission('inventory:view'), listIngredientUnits);
router.post(
  '/ingredient-units',
  requirePermission('inventory:edit'),
  [body('name').notEmpty()],
  validate,
  createIngredientUnit
);
router.put(
  '/ingredient-units/:id',
  requirePermission('inventory:edit'),
  [param('id').isMongoId()],
  validate,
  updateIngredientUnit
);
router.delete(
  '/ingredient-units/:id',
  requirePermission('inventory:edit'),
  [param('id').isMongoId()],
  validate,
  deleteIngredientUnit
);
router.post(
  '/ingredients',
  requirePermission('inventory:edit'),
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
  requirePermission('inventory:edit'),
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
  requirePermission('inventory:edit'),
  [param('id').isMongoId(), body('amount').isFloat({ min: 0.01 })],
  validate,
  restockIngredient
);
router.delete('/ingredients/:id', requirePermission('inventory:edit'), [param('id').isMongoId()], validate, deleteIngredient);

router.get('/transactions', requirePermission('inventory:view'), listTransactions);

router.post(
  '/recipes',
  requirePermission('inventory:edit'),
  [
    body('menuItem').isMongoId(),
    body('ingredients').isArray({ min: 1 }),
    body('ingredients.*.ingredient').isMongoId(),
    body('ingredients.*.quantity').isFloat({ min: 0.001 })
  ],
  validate,
  setRecipe
);

router.get('/recipes/:menuItem', requirePermission('inventory:view'), [param('menuItem').isMongoId()], validate, getRecipe);
router.get('/recipes', requirePermission('inventory:view'), listRecipes);
router.delete('/recipes/:id', requirePermission('inventory:edit'), [param('id').isMongoId()], validate, deleteRecipe);

module.exports = router;
