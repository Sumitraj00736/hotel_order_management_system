require('dotenv').config();
const mongoose = require('mongoose');
const PlatformAdmin = require('../models/honor/PlatformAdmin');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotel_order';

const seedPlatformAdmin = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for Platform Admin seeding');

    const email = 'sumitraj00736@gmail.com';
    const password = 'sumitraj00736';

    const existing = await PlatformAdmin.findOne({ email });
    if (existing) {
      existing.password = password;
      await existing.save();
      console.log('Updated existing Platform Admin password');
    } else {
      await PlatformAdmin.create({
        name: 'Sumit Raj',
        email,
        password,
        isSuperAdmin: true
      });
      console.log('Created new Platform Admin');
    }

    console.log('Platform Admin seeding complete');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedPlatformAdmin();
