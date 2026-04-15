require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/users/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hotel_order';

const migrate = async () => {
  await mongoose.connect(MONGO_URI);

  const users = await User.find();
  for (const user of users) {
    let changed = false;

    if (!user.dateOfJoining) {
      user.dateOfJoining = new Date('2024-01-01');
      changed = true;
    }

    if (user.salary === undefined || user.salary === null) {
      user.salary = user.role === 'admin' ? 5000 : user.role === 'kitchen' ? 2500 : 2000;
      changed = true;
    }

    if (!user.shiftStart) {
      user.shiftStart = user.role === 'kitchen' ? '08:00' : '09:00';
      changed = true;
    }

    if (!user.shiftEnd) {
      user.shiftEnd = user.role === 'kitchen' ? '17:00' : '18:00';
      changed = true;
    }

    if (changed) {
      await user.save();
    }
  }

  console.log('User migration complete');
  await mongoose.disconnect();
};

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
