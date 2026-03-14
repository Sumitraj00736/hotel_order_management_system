const Ingredient = require('../models/Ingredient');
const Recipe = require('../models/Recipe');
const StockTransaction = require('../models/StockTransaction');

const listIngredients = async (req, res) => {
  const ingredients = await Ingredient.find().sort({ name: 1 });
  return res.json(ingredients);
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
      sku
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
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }
    ingredient.currentStock += amount;
    ingredient.lastRestockedAt = new Date();
    await ingredient.save();

    await StockTransaction.create({
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
      { menuItem, ingredients: sanitized },
      { new: true, upsert: true }
    ).populate('ingredients.ingredient', 'name unit');
    return res.json(recipe);
  } catch (error) {
    return res.status(400).json({ message: 'Save recipe failed', error: error.message });
  }
};

const getRecipe = async (req, res) => {
  const recipe = await Recipe.findOne({ menuItem: req.params.menuItem }).populate(
    'ingredients.ingredient',
    'name unit'
  );
  if (!recipe) {
    return res.status(404).json({ message: 'Recipe not found' });
  }
  return res.json(recipe);
};

const listRecipes = async (req, res) => {
  const recipes = await Recipe.find()
    .populate('menuItem', 'name category price')
    .populate('ingredients.ingredient', 'name unit');
  return res.json(recipes);
};

module.exports = {
  listIngredients,
  createIngredient,
  updateIngredient,
  restockIngredient,
  listTransactions,
  setRecipe,
  getRecipe,
  listRecipes
};
