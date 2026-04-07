const Subscription = require('../models/Subscription');
const SubscriptionHistory = require('../models/SubscriptionHistory');
const UserBranchRole = require('../models/UserBranchRole');
const Table = require('../models/Table');
const MenuItem = require('../models/MenuItem');
const AddOn = require('../models/AddOn');
const CustomerHistory = require('../models/CustomerHistory');

const ensureSubscription = async (branchId) => {
  let sub = await Subscription.findOne({ branchId });
  if (!sub) {
    sub = await Subscription.create({ branchId });
  }
  return sub;
};

const getBillingSummary = async (req, res) => {
  const branchId = req.branchId;
  const subscription = await ensureSubscription(branchId);
  const [members, tables, dishes, addOns, customers, history] = await Promise.all([
    UserBranchRole.countDocuments({ branchId }),
    Table.countDocuments({ branchId }),
    MenuItem.countDocuments({ branchId }),
    AddOn.countDocuments({ branchId }),
    CustomerHistory.countDocuments({ branchId }),
    SubscriptionHistory.find({ branchId }).sort({ purchaseDate: -1 }).limit(10)
  ]);

  return res.json({
    plan: {
      name: subscription.planName,
      tier: subscription.tier,
      activeSince: subscription.activeSince,
      status: subscription.status
    },
    usage: {
      members: { used: members, limit: subscription.maxMembers },
      tables: { used: tables, limit: subscription.maxTables },
      customers: { used: customers, limit: subscription.maxCustomers },
      dishes: { used: dishes, limit: subscription.maxDishes },
      addOns: { used: addOns, limit: subscription.maxAddOns },
      spaces: { used: tables, limit: subscription.maxSpaces }
    },
    history
  });
};

module.exports = { getBillingSummary };
