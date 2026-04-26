const Subscription = require('../../models/core/Subscription');
const SubscriptionHistory = require('../../models/core/SubscriptionHistory');
const UserBranchRole = require('../../models/users/UserBranchRole');
const Table = require('../../models/tables/Table');
const MenuItem = require('../../models/menu/MenuItem');
const AddOn = require('../../models/menu/AddOn');
const Customer = require('../../models/customers/Customer');

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
    Customer.countDocuments({ branchId, active: { $ne: false } }),
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
