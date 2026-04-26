const mongoose = require('mongoose');
const Ingredient = require('../../models/inventory/Ingredient');
const IngredientUnit = require('../../models/inventory/IngredientUnit');
const Recipe = require('../../models/menu/Recipe');
const StockTransaction = require('../../models/inventory/StockTransaction');
const MenuItem = require('../../models/menu/MenuItem');

const roundAmount = (value) => Math.round(Number(value || 0) * 100) / 100;
const branchFilter = (req) => (req.branchId ? { branchId: req.branchId } : {});

const listIngredients = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  const ingredients = await Ingredient.find(filter).sort({ name: 1 });
  return res.json(ingredients);
};

const DEFAULT_INGREDIENT_UNITS = [
  { name: 'kg', label: 'Kilogram', symbol: 'kg' },
  { name: 'g', label: 'Gram', symbol: 'g' },
  { name: 'l', label: 'Liter', symbol: 'L' },
  { name: 'ml', label: 'Milliliter', symbol: 'ml' },
  { name: 'pcs', label: 'Pieces', symbol: 'pcs' },
  { name: 'pack', label: 'Pack', symbol: 'pack' },
  { name: 'bottle', label: 'Bottle', symbol: 'bottle' }
];

const ensureDefaultUnits = async (branchId) => {
  if (!branchId) return [];
  const existing = await IngredientUnit.find({ branchId }).select('name');
  const existingNames = new Set(existing.map((u) => (u.name || '').toLowerCase()));
  const missing = DEFAULT_INGREDIENT_UNITS.filter((unit) => !existingNames.has(unit.name.toLowerCase()));
  if (missing.length === 0) return existing;
  await IngredientUnit.insertMany(
    missing.map((unit) => ({
      branchId,
      name: unit.name,
      label: unit.label,
      symbol: unit.symbol,
      active: true
    }))
  );
  return IngredientUnit.find({ branchId }).select('name');
};

const listIngredientUnits = async (req, res) => {
  const filter = {};
  if (req.branchId) {
    filter.branchId = req.branchId;
    await ensureDefaultUnits(req.branchId);
  }
  const units = await IngredientUnit.find(filter).sort({ name: 1 });
  return res.json(units);
};

const createIngredientUnit = async (req, res) => {
  try {
    const { name, label, symbol, active } = req.body;
    if (!name) return res.status(400).json({ message: 'Unit name required' });
    const unit = await IngredientUnit.create({
      branchId: req.branchId,
      name: String(name).toLowerCase().trim(),
      label: label?.trim() || name,
      symbol: symbol?.trim(),
      active: active !== undefined ? active : true
    });
    return res.status(201).json(unit);
  } catch (error) {
    return res.status(400).json({ message: 'Create unit failed', error: error.message });
  }
};

const updateIngredientUnit = async (req, res) => {
  try {
    const updates = ['name', 'label', 'symbol', 'active'].reduce((acc, key) => {
      if (req.body[key] !== undefined) acc[key] = req.body[key];
      return acc;
    }, {});
    if (updates.name) updates.name = String(updates.name).toLowerCase().trim();
    if (updates.label) updates.label = String(updates.label).trim();
    if (updates.symbol) updates.symbol = String(updates.symbol).trim();
    const unit = await IngredientUnit.findOneAndUpdate(
      { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
      updates,
      { new: true }
    );
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    return res.json(unit);
  } catch (error) {
    return res.status(400).json({ message: 'Update unit failed', error: error.message });
  }
};

const deleteIngredientUnit = async (req, res) => {
  try {
    const unit = await IngredientUnit.findOne({
      _id: req.params.id,
      ...branchFilter(req)
    });
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    const ingredientUsingUnit = await Ingredient.exists({
      unit: unit.name,
      ...branchFilter(req)
    });
    if (ingredientUsingUnit) {
      return res.status(409).json({ message: 'Cannot delete unit that is used by ingredients' });
    }
    await IngredientUnit.deleteOne({ _id: unit._id, ...branchFilter(req) });
    return res.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    return res.status(400).json({ message: 'Delete unit failed', error: error.message });
  }
};

const createIngredient = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let ingredient;
    await session.withTransaction(async () => {
      const { name, unit, currentStock = 0, reorderLevel = 0, sku, defaultPrice, group, openingQty, openingRate } = req.body;
      const oQty = Number(openingQty ?? currentStock ?? 0);
      const oRate = Number(openingRate || defaultPrice || 0);
      const openingValue = roundAmount(oQty * oRate);
      [ingredient] = await Ingredient.create([{
        name,
        unit,
        currentStock: Number(currentStock),
        initialStock: Number(currentStock),
        reorderLevel: Number(reorderLevel),
        sku,
        branchId: req.branchId,
        defaultPrice: Number(defaultPrice || 0),
        group: group || undefined,
        openingQty: oQty,
        openingRate: oRate,
        openingValue
      }], { session });

      if (Number(currentStock) > 0) {
        await StockTransaction.create([{
          branchId: req.branchId,
          ingredient: ingredient._id,
          delta: Number(currentStock),
          reason: 'adjustment',
          unitCost: Number(defaultPrice || openingRate || 0),
          totalCost: openingValue,
          note: 'Opening stock entry',
          createdBy: req.user?._id
        }], { session });
      }
    });
    return res.status(201).json(ingredient);
  } catch (error) {
    return res.status(400).json({ message: 'Create ingredient failed', error: error.message });
  } finally {
    session.endSession();
  }
};

const updateIngredient = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let ingredient;
    await session.withTransaction(async () => {
      const existing = await Ingredient.findOne({
        _id: req.params.id,
        ...branchFilter(req)
      }).session(session);
      if (!existing) {
        throw new Error('Ingredient not found');
      }

      const allowedFields = ['name', 'unit', 'currentStock', 'reorderLevel', 'sku', 'defaultPrice', 'group', 'openingQty', 'openingRate'];
      const updates = allowedFields.reduce((acc, key) => {
        if (req.body[key] !== undefined) acc[key] = req.body[key];
        return acc;
      }, {});
      if (updates.openingQty !== undefined || updates.openingRate !== undefined) {
        const oQty = Number(updates.openingQty ?? existing.openingQty ?? 0);
        const oRate = Number(updates.openingRate ?? existing.openingRate ?? 0);
        updates.openingValue = roundAmount(oQty * oRate);
      }

      const hasStockChange = updates.currentStock !== undefined;
      const previousStock = Number(existing.currentStock || 0);
      const nextStock = hasStockChange ? Number(updates.currentStock || 0) : previousStock;
      if (hasStockChange && nextStock < 0) {
        throw new Error('currentStock cannot be negative');
      }

      ingredient = await Ingredient.findOneAndUpdate(
        { _id: req.params.id, ...branchFilter(req) },
        updates,
        { new: true, session }
      );

      if (hasStockChange) {
        const delta = roundAmount(nextStock - previousStock);
        if (delta !== 0) {
          await StockTransaction.create([{
            branchId: req.branchId,
            ingredient: ingredient._id,
            delta,
            reason: 'adjustment',
            unitCost: Number(ingredient.defaultPrice || 0),
            totalCost: roundAmount(Math.abs(delta) * Number(ingredient.defaultPrice || 0)),
            note: 'Manual stock adjustment from ingredient update',
            createdBy: req.user?._id
          }], { session });
        }
      }
    });
    return res.json(ingredient);
  } catch (error) {
    return res.status(error.message === 'Ingredient not found' ? 404 : 400).json({ message: 'Update ingredient failed', error: error.message });
  } finally {
    session.endSession();
  }
};

const restockIngredient = async (req, res) => {
  try {
    const { amount, note } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Amount must be positive' });
    }
    const ingredient = await Ingredient.findOne({ _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) });
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    ingredient.currentStock += Number(amount);
    ingredient.lastRestockedAt = new Date();
    await ingredient.save();

    await StockTransaction.create({
      branchId: req.branchId,
      ingredient: ingredient._id,
      delta: Number(amount),
      reason: 'restock',
      note,
      createdBy: req.user?._id
    });
    return res.json(ingredient);
  } catch (error) {
    return res.status(400).json({ message: 'Restock failed', error: error.message });
  }
};

const listTransactions = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  if (req.query.ingredient) filter.ingredient = req.query.ingredient;
  const txns = await StockTransaction.find(filter)
    .populate('ingredient', 'name unit')
    .populate('createdBy', 'name email role')
    .populate('referenceOrder', '_id')
    .sort({ createdAt: -1 })
    .limit(200);
  return res.json(txns);
};

const setRecipe = async (req, res) => {
  try {
    const { menuItem, ingredients } = req.body;
    if (!menuItem || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ message: 'Menu item and ingredients are required' });
    }
    const menu = await MenuItem.findOne({ _id: menuItem, ...branchFilter(req) }).select('_id');
    if (!menu) {
      return res.status(404).json({ message: 'Menu item not found for branch' });
    }
    const ingredientIds = ingredients.map((i) => i.ingredient).filter(Boolean);
    const ingredientDocs = await Ingredient.find({
      _id: { $in: ingredientIds },
      ...branchFilter(req)
    }).select('_id');
    if (ingredientDocs.length !== ingredientIds.length) {
      return res.status(400).json({ message: 'One or more ingredients do not belong to this branch' });
    }
    const sanitized = ingredients.map((i) => ({
      ingredient: i.ingredient,
      quantity: i.quantity
    }));
    const recipe = await Recipe.findOneAndUpdate(
      { menuItem },
      { menuItem, ingredients: sanitized, branchId: req.branchId },
      { new: true, upsert: true }
    ).populate('ingredients.ingredient', 'name unit');
    return res.json(recipe);
  } catch (error) {
    return res.status(400).json({ message: 'Save recipe failed', error: error.message });
  }
};

const getRecipe = async (req, res) => {
  const recipe = await Recipe.findOne({
    menuItem: req.params.menuItem,
    ...(req.branchId ? { branchId: req.branchId } : {})
  }).populate(
    'ingredients.ingredient',
    'name unit'
  );
  if (!recipe) {
    return res.status(404).json({ message: 'Recipe not found' });
  }
  return res.json(recipe);
};

const listRecipes = async (req, res) => {
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;
  const recipes = await Recipe.find(filter)
    .populate('menuItem', 'name category price')
    .populate('ingredients.ingredient', 'name unit');
  return res.json(recipes);
};

const deleteIngredient = async (req, res) => {
  try {
    const ingredient = await Ingredient.findOne({
      _id: req.params.id,
      ...branchFilter(req)
    });
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    const recipeUsingIngredient = await Recipe.exists({
      'ingredients.ingredient': ingredient._id,
      ...branchFilter(req)
    });
    if (recipeUsingIngredient) {
      return res.status(409).json({ message: 'Cannot delete ingredient that is used in recipes' });
    }
    const stockHistoryExists = await StockTransaction.exists({
      ingredient: ingredient._id,
      ...branchFilter(req)
    });
    if (stockHistoryExists) {
      return res.status(409).json({ message: 'Cannot delete ingredient with stock transaction history' });
    }
    await Ingredient.deleteOne({ _id: ingredient._id, ...branchFilter(req) });
    return res.json({ message: 'Ingredient deleted successfully' });
  } catch (error) {
    return res.status(400).json({ message: 'Delete ingredient failed', error: error.message });
  }
};

const deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndDelete({
      _id: req.params.id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    });
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    return res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    return res.status(400).json({ message: 'Delete recipe failed', error: error.message });
  }
};

module.exports = {
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
};
