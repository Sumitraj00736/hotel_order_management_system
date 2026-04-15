require('dotenv').config();
const mongoose = require('mongoose');

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

const run = async () => {
  if (!BRANCH_ID) throw new Error('Provide branchId: node scripts/wipeMenuData.js <branchId>');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing');

  await mongoose.connect(process.env.MONGO_URI);

  const branchId = BRANCH_ID;

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

  console.log(`✅ All menu + inventory data wiped for branch: ${branchId}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});