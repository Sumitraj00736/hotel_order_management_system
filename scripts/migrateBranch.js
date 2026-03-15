/* Migration: backfill branchId for legacy data with a default branch */
require('dotenv').config();
const mongoose = require('mongoose');
const Branch = require('../src/models/Branch');
const Organization = require('../src/models/Organization');
const User = require('../src/models/User');
const UserBranchRole = require('../src/models/UserBranchRole');
const models = {
  Table: require('../src/models/Table'),
  Category: require('../src/models/Category'),
  SubMenu: require('../src/models/SubMenu'),
  AddOn: require('../src/models/AddOn'),
  MenuItem: require('../src/models/MenuItem'),
  ComboOffer: require('../src/models/ComboOffer'),
  Recipe: require('../src/models/Recipe'),
  Ingredient: require('../src/models/Ingredient'),
  StockTransaction: require('../src/models/StockTransaction'),
  Order: require('../src/models/Order'),
  CustomerHistory: require('../src/models/CustomerHistory'),
  Notification: require('../src/models/Notification')
};

const run = async () => {
  const uri = 'mongodb+srv://sumitraj00736_db_user:sumitraj12345@cluster0.r4yyg1e.mongodb.net/';
  await mongoose.connect(uri);
  console.log('Connected');

  let org = await Organization.findOne();
  if (!org) org = await Organization.create({ name: 'Default Org' });
  let branch = await Branch.findOne();
  if (!branch) branch = await Branch.create({ name: 'Main Branch', code: 'default', orgId: org._id });

  // Ensure all admins are linked to default branch
  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await UserBranchRole.findOneAndUpdate(
      { userId: admin._id, branchId: branch._id },
      { userId: admin._id, branchId: branch._id, orgId: org._id, role: 'admin' },
      { upsert: true }
    );
  }

  // Backfill branchId on collections
  for (const [name, Model] of Object.entries(models)) {
    const res = await Model.updateMany({ branchId: { $exists: false } }, { $set: { branchId: branch._id } });
    console.log(`${name}: updated ${res.modifiedCount || 0}`);
  }

  console.log('Done');
  await mongoose.connection.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
