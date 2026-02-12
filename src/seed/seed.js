require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const menuItems = require('./menuItems');

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
    {
      name: 'Admin',
      email: 'admin@example.com',
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

  await MenuItem.create(menuItems);

  console.log('Seed data created');
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
