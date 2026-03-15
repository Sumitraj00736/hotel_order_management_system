/* Create branch-scoped unique indexes */
require('dotenv').config();
const mongoose = require('mongoose');
const Table = require('../src/models/Table');
const Category = require('../src/models/Category');
const SubMenu = require('../src/models/SubMenu');
const AddOn = require('../src/models/AddOn');
const MenuItem = require('../src/models/MenuItem');

const run = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hoteloms';
  await mongoose.connect(uri);
  console.log('Connected to', uri);

  await Table.collection.createIndex({ branchId: 1, tableNumber: 1 }, { unique: true, name: 'uniq_branch_tableNumber' });
  await Category.collection.createIndex({ branchId: 1, name: 1 }, { unique: true, name: 'uniq_branch_category_name' });
  await SubMenu.collection.createIndex({ branchId: 1, name: 1 }, { unique: true, name: 'uniq_branch_submenu_name' });
  await AddOn.collection.createIndex({ branchId: 1, name: 1 }, { unique: true, name: 'uniq_branch_addon_name' });
  await MenuItem.collection.createIndex({ branchId: 1, name: 1 }, { unique: true, name: 'uniq_branch_menu_name' });

  console.log('Indexes created');
  await mongoose.connection.close();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
