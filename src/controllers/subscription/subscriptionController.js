const Subscription = require('../../models/core/Subscription');
const MenuItem = require('../../models/menu/MenuItem');
const Table = require('../../models/tables/Table');
const UserBranchRole = require('../../models/users/UserBranchRole');
const Customer = require('../../models/customers/Customer');

/**
 * GET /api/subscription/my
 * Returns the current branch's subscription plan, limits, and live usage counts.
 * Used by the restaurant frontend to show upgrade prompts and lock premium features.
 */
const getMySubscription = async (req, res) => {
  try {
    const branchId = req.branchId;
    if (!branchId) return res.status(400).json({ message: 'No branch context' });

    const [subscription, dishCount, tableCount, memberCount, customerCount] = await Promise.all([
      Subscription.findOne({ branchId }).lean(),
      MenuItem.countDocuments({ branchId }),
      Table.countDocuments({ branchId, isTrashed: { $ne: true } }),
      UserBranchRole.countDocuments({ branchId, status: 'active' }),
      Customer.countDocuments({ branchId })
    ]);

    if (!subscription) {
      return res.json({
        tier: 'free',
        planName: 'Free Trial',
        status: 'active',
        limits: { maxMembers: 2, maxTables: 5, maxDishes: 50, maxCustomers: 10, maxAddOns: 5, maxSpaces: 0 },
        usage: { members: memberCount, tables: tableCount, dishes: dishCount, customers: customerCount },
        features: { inventory: false, accounting: false, crm: false, onlineDelivery: false, liveFinance: false, lowStockAlert: false, daybookEmail: false, customRoles: false, support: false }
      });
    }

    // Derive feature flags from tier
    const tier = (subscription.tier || 'free').toLowerCase();
    const isPremium = tier === 'premium' || tier === 'enterprise';
    const isBasicOrAbove = tier !== 'free';

    const features = {
      inventory:      isPremium,
      accounting:     isPremium,
      crm:            isPremium,
      onlineDelivery: isBasicOrAbove,
      liveFinance:    isPremium,
      lowStockAlert:  isPremium,
      daybookEmail:   isPremium,
      customRoles:    isPremium,
      support:        isPremium
    };

    return res.json({
      tier: subscription.tier,
      planName: subscription.planName,
      status: subscription.status,
      activeSince: subscription.activeSince,
      limits: {
        maxMembers:   subscription.maxMembers,
        maxTables:    subscription.maxTables,
        maxDishes:    subscription.maxDishes,
        maxCustomers: subscription.maxCustomers,
        maxAddOns:    subscription.maxAddOns,
        maxSpaces:    subscription.maxSpaces
      },
      usage: {
        members:   memberCount,
        tables:    tableCount,
        dishes:    dishCount,
        customers: customerCount
      },
      features
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch subscription', error: err.message });
  }
};

module.exports = { getMySubscription };
