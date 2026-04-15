require('dotenv').config();
const mongoose = require('mongoose');

const Branch = require('../src/models/core/Branch');
const Category = require('../src/models/menu/Category');
const SubMenu = require('../src/models/menu/SubMenu');
const AddOn = require('../src/models/menu/AddOn');
const MenuItem = require('../src/models/menu/MenuItem');
const ComboOffer = require('../src/models/menu/ComboOffer');
const Recipe = require('../src/models/menu/Recipe');
const Ingredient = require('../src/models/inventory/Ingredient');
const IngredientUnit = require('../src/models/inventory/IngredientUnit');
const StockTransaction = require('../src/models/inventory/StockTransaction');

const BRANCH_ID = process.argv[2];

const removeLegacyGlobalNameIndex = async (Model) => {
  const indexes = await Model.collection.indexes();
  const legacy = indexes.find((indexDef) => {
    const keyNames = Object.keys(indexDef.key || {});
    return indexDef.unique && keyNames.length === 1 && keyNames[0] === 'name';
  });
  if (legacy) {
    await Model.collection.dropIndex(legacy.name);
  }
  await Model.syncIndexes();
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in environment');
  }

  if (!BRANCH_ID) {
    throw new Error('Please provide a branchId as argument: node scripts/resetAdminCafeMenuData.js <branchId>');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const branchId = BRANCH_ID;
  const branch = await Branch.findById(branchId).lean();
  if (!branch) {
    throw new Error(`Branch ${branchId} not found`);
  }

  console.log(`Resetting menu + inventory data for branch: ${branch?.name || 'unknown'} (${branchId})`);

  await removeLegacyGlobalNameIndex(Category);
  await removeLegacyGlobalNameIndex(SubMenu);
  await removeLegacyGlobalNameIndex(AddOn);
  await removeLegacyGlobalNameIndex(Ingredient);

  await Promise.all([
    Recipe.deleteMany({ branchId }),
    MenuItem.deleteMany({ branchId }),
    ComboOffer.deleteMany({ branchId }),
    AddOn.deleteMany({ branchId }),
    SubMenu.deleteMany({ branchId }),
    Category.deleteMany({ branchId }),
    StockTransaction.deleteMany({ branchId }),
    Ingredient.deleteMany({ branchId }),
    IngredientUnit.deleteMany({ branchId })
  ]);

  const categories = await Category.insertMany([
    { branchId, name: 'Beverages', active: true },
    { branchId, name: 'Lunch', active: true },
    { branchId, name: 'Snacks', active: true },
    { branchId, name: 'Main Course', active: true }
  ]);
  const categoryMap = new Map(categories.map((item) => [item.name, item._id]));

  const subMenus = await SubMenu.insertMany([
    { branchId, name: 'Cafe Menu', active: true },
    { branchId, name: 'Food Menu', active: true },
    { branchId, name: 'Drinks Menu', active: true }
  ]);
  const subMenuMap = new Map(subMenus.map((item) => [item.name, item._id]));

  const addOns = await AddOn.insertMany([
    { branchId, name: 'Extra Cheese', type: 'extra', price: 50, active: true },
    { branchId, name: 'Extra Mayonnaise', type: 'extra', price: 30, active: true },
    { branchId, name: 'French Fries Add-on', type: 'extra', price: 90, active: true },
    { branchId, name: 'Honey', type: 'extra', price: 20, active: true },
    { branchId, name: 'Sugar Syrup', type: 'extra', price: 20, active: true }
  ]);
  const addOnMap = new Map(addOns.map((item) => [item.name, item._id]));

  await IngredientUnit.insertMany([
    { branchId, name: 'kg', label: 'Kilogram', symbol: 'kg', active: true },
    { branchId, name: 'g', label: 'Gram', symbol: 'g', active: true },
    { branchId, name: 'ml', label: 'Milliliter', symbol: 'ml', active: true },
    { branchId, name: 'pcs', label: 'Pieces', symbol: 'pcs', active: true },
    { branchId, name: 'l', label: 'Liter', symbol: 'L', active: true }
  ]);

  const ingredients = await Ingredient.insertMany([
    { branchId, name: 'Chicken', unit: 'kg', currentStock: 25, initialStock: 25, reorderLevel: 5 },
    { branchId, name: 'Veg Patty', unit: 'pcs', currentStock: 80, initialStock: 80, reorderLevel: 15 },
    { branchId, name: 'Burger Bun', unit: 'pcs', currentStock: 150, initialStock: 150, reorderLevel: 30 },
    { branchId, name: 'Pizza Base', unit: 'pcs', currentStock: 100, initialStock: 100, reorderLevel: 20 },
    { branchId, name: 'Mozzarella Cheese', unit: 'kg', currentStock: 18, initialStock: 18, reorderLevel: 4 },
    { branchId, name: 'Coffee Beans', unit: 'kg', currentStock: 10, initialStock: 10, reorderLevel: 2 },
    { branchId, name: 'Milk', unit: 'l', currentStock: 40, initialStock: 40, reorderLevel: 8 },
    { branchId, name: 'Noodles', unit: 'kg', currentStock: 30, initialStock: 30, reorderLevel: 6 },
    { branchId, name: 'Momo Wrapper', unit: 'pcs', currentStock: 250, initialStock: 250, reorderLevel: 60 },
    { branchId, name: 'Tomato Sauce', unit: 'kg', currentStock: 12, initialStock: 12, reorderLevel: 3 },
    { branchId, name: 'Sugar', unit: 'kg', currentStock: 15, initialStock: 15, reorderLevel: 3 },
    { branchId, name: 'Soft Drink Bottle', unit: 'pcs', currentStock: 300, initialStock: 300, reorderLevel: 50 }
  ]);
  const ingredientMap = new Map(ingredients.map((item) => [item.name, item._id]));

  const menuItems = await MenuItem.insertMany([
    {
      branchId,
      name: 'Burger',
      category: categoryMap.get('Lunch'),
      subMenu: subMenuMap.get('Food Menu'),
      type: 'Non-Veg',
      price: 180,
      maxPrice: 250,
      variants: [
        { type: 'Non-Veg', name: 'Chicken', actualPrice: 220, discount: 0, price: 220 },
        { type: 'Veg', name: 'Veg', actualPrice: 180, discount: 0, price: 180 },
        { type: 'Non-Veg', name: 'Crunchy', actualPrice: 250, discount: 0, price: 250 }
      ],
      addOns: [addOnMap.get('Extra Cheese'), addOnMap.get('Extra Mayonnaise')],
      preparationTimeMinutes: 15,
      isAvailable: true
    },
    {
      branchId,
      name: 'Chicken Pizza',
      category: categoryMap.get('Lunch'),
      subMenu: subMenuMap.get('Food Menu'),
      type: 'Non-Veg',
      price: 300,
      maxPrice: 600,
      variants: [
        { type: 'Non-Veg', name: 'Regular', actualPrice: 300, discount: 0, price: 300 },
        { type: 'Non-Veg', name: 'Medium', actualPrice: 450, discount: 0, price: 450 },
        { type: 'Non-Veg', name: 'Large', actualPrice: 600, discount: 0, price: 600 }
      ],
      addOns: [addOnMap.get('Extra Cheese')],
      preparationTimeMinutes: 20,
      isAvailable: true
    },
    {
      branchId,
      name: 'Iced Latte',
      category: categoryMap.get('Beverages'),
      subMenu: subMenuMap.get('Cafe Menu'),
      type: 'Veg',
      price: 180,
      variants: [],
      addOns: [addOnMap.get('Sugar Syrup')],
      preparationTimeMinutes: 8,
      isAvailable: true
    },
    {
      branchId,
      name: 'Coffee',
      category: categoryMap.get('Beverages'),
      subMenu: subMenuMap.get('Cafe Menu'),
      type: 'Veg',
      price: 130,
      variants: [],
      preparationTimeMinutes: 6,
      isAvailable: true
    },
    {
      branchId,
      name: 'Water Bottle',
      category: categoryMap.get('Beverages'),
      subMenu: subMenuMap.get('Drinks Menu'),
      type: 'Veg',
      price: 25,
      variants: [],
      preparationTimeMinutes: 0,
      isAvailable: true
    },
    {
      branchId,
      name: 'Coke',
      category: categoryMap.get('Beverages'),
      subMenu: subMenuMap.get('Drinks Menu'),
      type: 'Veg',
      price: 60,
      variants: [],
      preparationTimeMinutes: 0,
      isAvailable: true
    },
    {
      branchId,
      name: 'Fanta',
      category: categoryMap.get('Beverages'),
      subMenu: subMenuMap.get('Drinks Menu'),
      type: 'Veg',
      price: 60,
      variants: [],
      preparationTimeMinutes: 0,
      isAvailable: true
    },
    {
      branchId,
      name: 'Chicken Chowmein',
      category: categoryMap.get('Main Course'),
      subMenu: subMenuMap.get('Food Menu'),
      type: 'Non-Veg',
      price: 220,
      variants: [],
      addOns: [addOnMap.get('Extra Mayonnaise')],
      preparationTimeMinutes: 18,
      isAvailable: true
    },
    {
      branchId,
      name: 'Veg Momo',
      category: categoryMap.get('Snacks'),
      subMenu: subMenuMap.get('Food Menu'),
      type: 'Veg',
      price: 180,
      variants: [],
      addOns: [addOnMap.get('Honey')],
      preparationTimeMinutes: 15,
      isAvailable: true
    },
    {
      branchId,
      name: 'French Fries',
      category: categoryMap.get('Snacks'),
      subMenu: subMenuMap.get('Cafe Menu'),
      type: 'Veg',
      price: 140,
      variants: [],
      addOns: [addOnMap.get('French Fries Add-on')],
      preparationTimeMinutes: 10,
      isAvailable: true
    }
  ]);
  const menuMap = new Map(menuItems.map((item) => [item.name, item]));

  await Recipe.insertMany([
    {
      branchId,
      menuItem: menuMap.get('Burger')._id,
      ingredients: [
        { ingredient: ingredientMap.get('Burger Bun'), quantity: 1 },
        { ingredient: ingredientMap.get('Chicken'), quantity: 0.12 },
        { ingredient: ingredientMap.get('Mozzarella Cheese'), quantity: 0.02 },
        { ingredient: ingredientMap.get('Tomato Sauce'), quantity: 0.01 }
      ]
    },
    {
      branchId,
      menuItem: menuMap.get('Chicken Pizza')._id,
      ingredients: [
        { ingredient: ingredientMap.get('Pizza Base'), quantity: 1 },
        { ingredient: ingredientMap.get('Chicken'), quantity: 0.14 },
        { ingredient: ingredientMap.get('Mozzarella Cheese'), quantity: 0.08 },
        { ingredient: ingredientMap.get('Tomato Sauce'), quantity: 0.03 }
      ]
    },
    {
      branchId,
      menuItem: menuMap.get('Iced Latte')._id,
      ingredients: [
        { ingredient: ingredientMap.get('Coffee Beans'), quantity: 0.015 },
        { ingredient: ingredientMap.get('Milk'), quantity: 0.22 },
        { ingredient: ingredientMap.get('Sugar'), quantity: 0.01 }
      ]
    },
    {
      branchId,
      menuItem: menuMap.get('Coffee')._id,
      ingredients: [
        { ingredient: ingredientMap.get('Coffee Beans'), quantity: 0.012 },
        { ingredient: ingredientMap.get('Milk'), quantity: 0.12 },
        { ingredient: ingredientMap.get('Sugar'), quantity: 0.008 }
      ]
    },
    {
      branchId,
      menuItem: menuMap.get('Water Bottle')._id,
      ingredients: [{ ingredient: ingredientMap.get('Soft Drink Bottle'), quantity: 1 }]
    },
    {
      branchId,
      menuItem: menuMap.get('Coke')._id,
      ingredients: [{ ingredient: ingredientMap.get('Soft Drink Bottle'), quantity: 1 }]
    },
    {
      branchId,
      menuItem: menuMap.get('Fanta')._id,
      ingredients: [{ ingredient: ingredientMap.get('Soft Drink Bottle'), quantity: 1 }]
    },
    {
      branchId,
      menuItem: menuMap.get('Chicken Chowmein')._id,
      ingredients: [
        { ingredient: ingredientMap.get('Noodles'), quantity: 0.2 },
        { ingredient: ingredientMap.get('Chicken'), quantity: 0.11 },
        { ingredient: ingredientMap.get('Tomato Sauce'), quantity: 0.01 }
      ]
    },
    {
      branchId,
      menuItem: menuMap.get('Veg Momo')._id,
      ingredients: [
        { ingredient: ingredientMap.get('Momo Wrapper'), quantity: 10 },
        { ingredient: ingredientMap.get('Veg Patty'), quantity: 1 }
      ]
    },
    {
      branchId,
      menuItem: menuMap.get('French Fries')._id,
      ingredients: [{ ingredient: ingredientMap.get('Veg Patty'), quantity: 0.4 }]
    }
  ]);

  await ComboOffer.insertMany([
    {
      branchId,
      name: 'Snack Combo',
      type: 'Combo',
      category: categoryMap.get('Snacks'),
      subMenu: subMenuMap.get('Cafe Menu'),
      items: [
        { menuItem: menuMap.get('French Fries')._id, quantity: 1, unitPrice: menuMap.get('French Fries').price },
        { menuItem: menuMap.get('Coke')._id, quantity: 1, unitPrice: menuMap.get('Coke').price }
      ],
      priceActual: 200,
      priceOffer: 180,
      prepTimeMinutes: 10,
      active: true
    },
    {
      branchId,
      name: 'Burger Drink Combo',
      type: 'Combo',
      category: categoryMap.get('Lunch'),
      subMenu: subMenuMap.get('Food Menu'),
      items: [
        { menuItem: menuMap.get('Burger')._id, quantity: 1, unitPrice: menuMap.get('Burger').price },
        { menuItem: menuMap.get('Fanta')._id, quantity: 1, unitPrice: menuMap.get('Fanta').price }
      ],
      priceActual: 240,
      priceOffer: 219,
      prepTimeMinutes: 15,
      active: true
    },
    {
      branchId,
      name: 'Pizza Party Combo',
      type: 'Combo',
      category: categoryMap.get('Lunch'),
      subMenu: subMenuMap.get('Food Menu'),
      items: [
        { menuItem: menuMap.get('Chicken Pizza')._id, quantity: 1, unitPrice: menuMap.get('Chicken Pizza').price },
        { menuItem: menuMap.get('Coke')._id, quantity: 1, unitPrice: menuMap.get('Coke').price }
      ],
      priceActual: 360,
      priceOffer: 330,
      prepTimeMinutes: 22,
      active: true
    },
    {
      branchId,
      name: 'Cafe Duo',
      type: 'Combo',
      category: categoryMap.get('Beverages'),
      subMenu: subMenuMap.get('Cafe Menu'),
      items: [
        { menuItem: menuMap.get('Iced Latte')._id, quantity: 1, unitPrice: menuMap.get('Iced Latte').price },
        { menuItem: menuMap.get('Coffee')._id, quantity: 1, unitPrice: menuMap.get('Coffee').price }
      ],
      priceActual: 310,
      priceOffer: 280,
      prepTimeMinutes: 8,
      active: true
    }
  ]);

  console.log(
    JSON.stringify(
      {
        branchId: branchId.toString(),
        categories: categories.length,
        subMenus: subMenus.length,
        addOns: addOns.length,
        menuItems: menuItems.length,
        combos: 4,
        ingredients: ingredients.length
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});