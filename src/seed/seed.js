require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotel_order';

const seed = async () => {
  await mongoose.connect(MONGO_URI);

  await User.deleteMany({});
  await Table.deleteMany({});
  await MenuItem.deleteMany({});

  const adminPassword = await bcrypt.hash('admin123', 10);
  const waiterPassword = await bcrypt.hash('waiter123', 10);
  const kitchenPassword = await bcrypt.hash('kitchen123', 10);

  await User.create([
    { name: 'Admin', email: 'admin@example.com', password: adminPassword, role: 'admin' },
    { name: 'Waiter One', email: 'waiter@example.com', password: waiterPassword, role: 'waiter' },
    { name: 'Kitchen One', email: 'kitchen@example.com', password: kitchenPassword, role: 'kitchen' }
  ]);

  await Table.create([
    { tableNumber: 1, status: 'available' },
    { tableNumber: 2, status: 'available' },
    { tableNumber: 3, status: 'available' }
  ]);

  await MenuItem.create([
    { name: 'Margherita Pizza', category: 'Pizza', price: 12.5, isAvailable: true },
    { name: 'Chicken Burger', category: 'Burger', price: 9.5, isAvailable: true },
    { name: 'Caesar Salad', category: 'Salad', price: 7.5, isAvailable: true }
  ]);

  console.log('Seed data created');
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
