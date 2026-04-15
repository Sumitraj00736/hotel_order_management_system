require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/users/User');
const Table = require('../models/tables/Table');
const MenuItem = require('../models/menu/MenuItem');
const Ingredient = require('../models/inventory/Ingredient');
const Recipe = require('../models/menu/Recipe');
const menuItems = require('./menuItems');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotel_order';

// Representative, publicly hosted food images per category
const CATEGORY_IMAGES = {
  Burger: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
  'Fried Chicken': 'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?auto=format&fit=crop&w=800&q=80',
  'Hot Dog': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
  'Stick Food': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80',
  'Chowmein & Thukpa': 'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=800&q=80',
  'Fried Rice': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80',
  Momo: 'https://images.unsplash.com/photo-1585238341986-46b8f262c8d1?auto=format&fit=crop&w=800&q=80',
  Chopsuey: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
  Pasta: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=800&q=80',
  Pizza: 'https://images.unsplash.com/photo-1548365328-5b76b16f8c84?auto=format&fit=crop&w=800&q=80',
  Biryani: 'https://images.unsplash.com/photo-1604908177760-1a4e63f3c981?auto=format&fit=crop&w=800&q=80',
  Chhoila: 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=800&q=80',
  'Veg Snacks': 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80',
  'Non-Veg Snacks': 'https://images.unsplash.com/photo-1604908177520-402b3cd293b2?auto=format&fit=crop&w=800&q=80',
  Wrap: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80',
  'Cold Coffee': 'https://images.unsplash.com/photo-1464305795204-6f5bbfc7fb81?auto=format&fit=crop&w=800&q=80',
  Milkshake: 'https://images.unsplash.com/photo-1523475472560-d2df97ec485c?auto=format&fit=crop&w=800&q=80',
  'Frozen Momo': 'https://images.unsplash.com/photo-1585238341986-46b8f262c8d1?auto=format&fit=crop&w=800&q=80',
  default: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80'
};

// Simplified ingredient definitions
const BASE_INGREDIENTS = [
  { name: 'Burger Bun', unit: 'pcs', currentStock: 200, reorderLevel: 50 },
  { name: 'Beef Patty', unit: 'pcs', currentStock: 150, reorderLevel: 40 },
  { name: 'Chicken Breast', unit: 'kg', currentStock: 50, reorderLevel: 10 },
  { name: 'Veg Patty', unit: 'pcs', currentStock: 150, reorderLevel: 40 },
  { name: 'Lettuce', unit: 'kg', currentStock: 20, reorderLevel: 5 },
  { name: 'Tomato', unit: 'kg', currentStock: 20, reorderLevel: 5 },
  { name: 'Cheese Slice', unit: 'pcs', currentStock: 200, reorderLevel: 40 },
  { name: 'Fries', unit: 'kg', currentStock: 60, reorderLevel: 15 },
  { name: 'Hotdog Bun', unit: 'pcs', currentStock: 120, reorderLevel: 30 },
  { name: 'Hotdog Sausage', unit: 'pcs', currentStock: 200, reorderLevel: 50 },
  { name: 'Chicken Wing', unit: 'kg', currentStock: 40, reorderLevel: 10 },
  { name: 'All-purpose Flour', unit: 'kg', currentStock: 80, reorderLevel: 20 },
  { name: 'Oil', unit: 'L', currentStock: 100, reorderLevel: 25 },
  { name: 'Rice', unit: 'kg', currentStock: 100, reorderLevel: 25 },
  { name: 'Noodles', unit: 'kg', currentStock: 80, reorderLevel: 20 },
  { name: 'Momo Wrapper', unit: 'pcs', currentStock: 500, reorderLevel: 120 },
  { name: 'Paneer', unit: 'kg', currentStock: 30, reorderLevel: 8 },
  { name: 'Buff Meat', unit: 'kg', currentStock: 40, reorderLevel: 10 },
  { name: 'Pork', unit: 'kg', currentStock: 30, reorderLevel: 8 },
  { name: 'Pizza Base', unit: 'pcs', currentStock: 120, reorderLevel: 30 },
  { name: 'Mozzarella', unit: 'kg', currentStock: 25, reorderLevel: 6 },
  { name: 'Tomato Sauce', unit: 'kg', currentStock: 30, reorderLevel: 8 },
  { name: 'Pasta', unit: 'kg', currentStock: 40, reorderLevel: 10 },
  { name: 'Milk', unit: 'L', currentStock: 50, reorderLevel: 12 },
  { name: 'Coffee Beans', unit: 'kg', currentStock: 15, reorderLevel: 4 },
  { name: 'Ice Cream', unit: 'kg', currentStock: 30, reorderLevel: 8 },
  { name: 'Spice Mix', unit: 'kg', currentStock: 20, reorderLevel: 5 },
  { name: 'Onion', unit: 'kg', currentStock: 30, reorderLevel: 8 },
  { name: 'Capsicum', unit: 'kg', currentStock: 20, reorderLevel: 5 },
  { name: 'Egg', unit: 'pcs', currentStock: 300, reorderLevel: 80 }
];

// Recipe templates per category
const CATEGORY_RECIPES = {
  Burger: [
    { name: 'Burger Bun', qty: 1 },
    { name: 'Cheese Slice', qty: 1 },
    { name: 'Lettuce', qty: 0.05 },
    { name: 'Tomato', qty: 0.05 },
    { name: 'Fries', qty: 0.15 }
  ],
  'Fried Chicken': [
    { name: 'Chicken Wing', qty: 0.25 },
    { name: 'All-purpose Flour', qty: 0.05 },
    { name: 'Oil', qty: 0.1 },
    { name: 'Spice Mix', qty: 0.02 }
  ],
  'Hot Dog': [
    { name: 'Hotdog Bun', qty: 1 },
    { name: 'Hotdog Sausage', qty: 1 },
    { name: 'Tomato', qty: 0.03 }
  ],
  'Stick Food': [
    { name: 'Hotdog Sausage', qty: 1 },
    { name: 'Spice Mix', qty: 0.01 }
  ],
  'Chowmein & Thukpa': [
    { name: 'Noodles', qty: 0.18 },
    { name: 'Onion', qty: 0.05 },
    { name: 'Capsicum', qty: 0.05 },
    { name: 'Spice Mix', qty: 0.02 }
  ],
  'Fried Rice': [
    { name: 'Rice', qty: 0.2 },
    { name: 'Egg', qty: 1 },
    { name: 'Onion', qty: 0.05 },
    { name: 'Spice Mix', qty: 0.02 }
  ],
  'Spring Roll': [
    { name: 'Veg Patty', qty: 0.5 },
    { name: 'All-purpose Flour', qty: 0.05 },
    { name: 'Oil', qty: 0.08 }
  ],
  Wrap: [
    { name: 'Veg Patty', qty: 0.5 },
    { name: 'Lettuce', qty: 0.05 },
    { name: 'Tomato', qty: 0.05 }
  ],
  Momo: [
    { name: 'Momo Wrapper', qty: 10 },
    { name: 'Chicken Breast', qty: 0.15 },
    { name: 'Onion', qty: 0.05 },
    { name: 'Spice Mix', qty: 0.02 }
  ],
  Chopsuey: [
    { name: 'Noodles', qty: 0.15 },
    { name: 'Onion', qty: 0.05 },
    { name: 'Capsicum', qty: 0.05 },
    { name: 'Spice Mix', qty: 0.02 }
  ],
  Pasta: [
    { name: 'Pasta', qty: 0.18 },
    { name: 'Tomato Sauce', qty: 0.08 },
    { name: 'Cheese Slice', qty: 1 }
  ],
  Pizza: [
    { name: 'Pizza Base', qty: 1 },
    { name: 'Tomato Sauce', qty: 0.08 },
    { name: 'Mozzarella', qty: 0.12 }
  ],
  Biryani: [
    { name: 'Rice', qty: 0.22 },
    { name: 'Chicken Breast', qty: 0.15 },
    { name: 'Spice Mix', qty: 0.03 },
    { name: 'Onion', qty: 0.05 }
  ],
  Chhoila: [
    { name: 'Buff Meat', qty: 0.18 },
    { name: 'Spice Mix', qty: 0.03 },
    { name: 'Onion', qty: 0.05 }
  ],
  'Veg Snacks': [
    { name: 'Potato', qty: 0.2 },
    { name: 'Oil', qty: 0.05 },
    { name: 'Spice Mix', qty: 0.02 }
  ],
  'Non-Veg Snacks': [
    { name: 'Chicken Breast', qty: 0.15 },
    { name: 'Oil', qty: 0.05 },
    { name: 'Spice Mix', qty: 0.02 }
  ],
  'Burger House Special': [
    { name: 'Chicken Breast', qty: 0.2 },
    { name: 'Spice Mix', qty: 0.03 },
    { name: 'Onion', qty: 0.05 }
  ],
  'Cold Coffee': [
    { name: 'Coffee Beans', qty: 0.02 },
    { name: 'Milk', qty: 0.25 },
    { name: 'Ice Cream', qty: 0.05 }
  ],
  Milkshake: [
    { name: 'Milk', qty: 0.25 },
    { name: 'Ice Cream', qty: 0.08 }
  ],
  'Frozen Momo': [
    { name: 'Momo Wrapper', qty: 10 },
    { name: 'Chicken Breast', qty: 0.15 },
    { name: 'Spice Mix', qty: 0.02 }
  ]
};

const seed = async () => {
  await mongoose.connect(MONGO_URI);

  await User.deleteMany({});
  await Table.deleteMany({});
  await MenuItem.deleteMany({});
  await Ingredient.deleteMany({});
  await Recipe.deleteMany({});

  const adminPassword = await bcrypt.hash('admin123', 10);
  const waiterPassword = await bcrypt.hash('waiter123', 10);
  const kitchenPassword = await bcrypt.hash('kitchen123', 10);

  await User.create([
    {
      name: 'Admin',
      email: 'admin@example.com',
      phone: '9800000001',
      password: adminPassword,
      role: 'admin',
      dateOfJoining: new Date('2024-01-01'),
      salary: 5000,
      shiftStart: '09:00',
      shiftEnd: '18:00'
    },
    {
      name: 'Waiter One',
      email: 'waiter@example.com',
      phone: '9800000002',
      password: waiterPassword,
      role: 'waiter',
      dateOfJoining: new Date('2024-02-01'),
      salary: 2000,
      shiftStart: '10:00',
      shiftEnd: '19:00'
    },
    {
      name: 'Kitchen One',
      email: 'kitchen@example.com',
      phone: '9800000003',
      password: kitchenPassword,
      role: 'kitchen',
      dateOfJoining: new Date('2024-03-01'),
      salary: 2500,
      shiftStart: '08:00',
      shiftEnd: '17:00'
    }
  ]);

  await Table.create([
    { tableNumber: 1, status: 'available' },
    { tableNumber: 2, status: 'available' },
    { tableNumber: 3, status: 'available' }
  ]);

  const ingredients = await Ingredient.insertMany(
    BASE_INGREDIENTS.map((ing) => ({ ...ing, initialStock: ing.currentStock }))
  );
  const ingMap = ingredients.reduce((acc, ing) => {
    acc[ing.name] = ing._id;
    return acc;
  }, {});

  const menuWithImages = menuItems.map((item) => ({
    ...item,
    imageUrl: CATEGORY_IMAGES[item.category] || CATEGORY_IMAGES.default
  }));

  const createdMenus = await MenuItem.create(menuWithImages);

  // Create recipes based on category templates
  // eslint-disable-next-line no-restricted-syntax
  for (const menu of createdMenus) {
    const template = CATEGORY_RECIPES[menu.category] || [];
    const ingredientsArr = template
      .filter((t) => ingMap[t.name])
      .map((t) => ({
        ingredient: ingMap[t.name],
        quantity: t.qty
      }));
    if (ingredientsArr.length > 0) {
      await Recipe.create({ menuItem: menu._id, ingredients: ingredientsArr });
    }
  }

  console.log('Seed data created');
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
