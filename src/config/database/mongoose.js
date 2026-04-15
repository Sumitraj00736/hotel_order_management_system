const mongoose = require('mongoose');
const Table = require('../../models/tables/Table');
const { env } = require('../env');

const connectDatabase = async () => {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB connected');

  try {
    const indexes = await Table.collection.indexes();
    const legacyIndex = indexes.find((indexDef) => indexDef.name === 'tableNumber_1');
    if (legacyIndex) {
      await Table.collection.dropIndex('tableNumber_1');
    }
    await Table.syncIndexes();
  } catch (error) {
    console.warn('Table index sync skipped:', error.message);
  }
};

module.exports = {
  connectDatabase
};
