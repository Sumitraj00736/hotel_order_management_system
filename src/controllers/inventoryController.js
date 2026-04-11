const Ingredient = require('../models/Ingredient');
const IngredientUnit = require('../models/IngredientUnit');
const Recipe = require('../models/Recipe');
const StockTransaction = require('../models/StockTransaction');

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
    const unit = await IngredientUnit.findOneAndDelete({
      _id: req.params.id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    });
    if (!unit) return res.status(404).json({ message: 'Unit not found' });
    return res.json({ message: 'Unit deleted successfully' });
  } catch (error) {
    return res.status(400).json({ message: 'Delete unit failed', error: error.message });
  }
};

const createIngredient = async (req, res) => {
  try {
    const { name, unit, currentStock = 0, reorderLevel = 0, sku } = req.body;
    const ingredient = await Ingredient.create({
      name,
      unit,
      currentStock,
      initialStock: currentStock,
      reorderLevel,
      sku,
      branchId: req.branchId
    });
    return res.status(201).json(ingredient);
  } catch (error) {
    return res.status(400).json({ message: 'Create ingredient failed', error: error.message });
  }
};

const updateIngredient = async (req, res) => {
  try {
    const updates = ['name', 'unit', 'currentStock', 'reorderLevel', 'sku'].reduce((acc, key) => {
      if (req.body[key] !== undefined) acc[key] = req.body[key];
      return acc;
    }, {});
    const ingredient = await Ingredient.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    return res.json(ingredient);
  } catch (error) {
    return res.status(400).json({ message: 'Update ingredient failed', error: error.message });
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
    ingredient.currentStock += amount;
    ingredient.lastRestockedAt = new Date();
    await ingredient.save();

    await StockTransaction.create({
      branchId: req.branchId,
      ingredient: ingredient._id,
      delta: amount,
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
    const ingredient = await Ingredient.findOneAndDelete({
      _id: req.params.id,
      ...(req.branchId ? { branchId: req.branchId } : {})
    });
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    // Also delete recipes referencing this ingredient? 
    // Usually better to just warn or keep them but with a "missing" flag.
    // For now, let's just delete the ingredient.
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
