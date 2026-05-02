const Subscription = require('../models/platform/Subscription');
const MenuItem = require('../models/menu/MenuItem');
const Table = require('../models/tables/Table');
const UserBranchRole = require('../models/users/UserBranchRole');
const Customer = require('../models/customers/Customer');

/**
 * Factory: creates middleware that checks a specific plan limit before creation.
 */
const checkPlanLimit = (limitKey, countFn, resourceLabel) => async (req, res, next) => {
  try {
    const branchId = req.branchId;
    if (!branchId) return next();

    const subscription = await Subscription.findOne({ branchId }).lean();
    if (!subscription) return next();

    // 1. Check for Expiry
    if (subscription.expiryDate && new Date(subscription.expiryDate) < new Date()) {
      return res.status(403).json({
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription has expired. Please renew to continue.',
        upgradeRequired: true
      });
    }

    // 2. Check for "Archived" or "Suspended" status
    if (subscription.status !== 'active') {
      return res.status(403).json({
        code: 'SUBSCRIPTION_INACTIVE',
        message: `Your subscription is currently ${subscription.status}. Please contact support.`,
        upgradeRequired: true
      });
    }

    // 3. Check specific count limit
    const limit = subscription[limitKey];
    if (typeof limit !== 'number' || limit <= 0) return next(); // 0 or null = unlimited sentinel

    const currentCount = await countFn(branchId);
    if (currentCount >= limit) {
      return res.status(403).json({
        code: 'PLAN_LIMIT_REACHED',
        message: `Plan Limit Reached: Your current plan allows only ${limit} ${resourceLabel}.`,
        limit,
        current: currentCount,
        limitKey,
        upgradeRequired: true
      });
    }

    req.subscription = subscription;
    return next();
  } catch (err) {
    console.error('[checkPlanLimit]', err.message);
    return next(); // Fail open for safety, but log it
  }
};

/**
 * Middleware to check if a specific feature is enabled in the current plan.
 * Usage: router.use('/inventory', checkFeature('inventory'));
 */
const checkFeature = (featureKey) => async (req, res, next) => {
  try {
    const branchId = req.branchId;
    if (!branchId) return next();

    // Use pre-loaded subscription from branchScope if available
    let subscription = req.subscription;
    if (!subscription) {
      const Subscription = require('../models/platform/Subscription');
      subscription = await Subscription.findOne({ branchId }).lean();
    }
    
    if (!subscription) return next();

    // Check expiry
    const isExpired = subscription.expiryDate && new Date(subscription.expiryDate) < new Date();
    if (isExpired && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
       return res.status(403).json({ code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired.' });
    }

    const features = subscription.features || {};
    const isEnabled = features instanceof Map ? features.get(featureKey) : features[featureKey];

    if (!isEnabled) {
      return res.status(403).json({
        code: 'FEATURE_LOCKED',
        message: `Upgrade Required: The "${featureKey}" module is not included in your current plan.`,
        featureKey,
        upgradeRequired: true
      });
    }

    next();
  } catch (err) {
    next();
  }
};

// Pre-built checkers
const limitDishes    = checkPlanLimit('maxDishes',    (b) => MenuItem.countDocuments({ branchId: b }),                         'menu items');
const limitTables    = checkPlanLimit('maxTables',    (b) => Table.countDocuments({ branchId: b, isTrashed: { $ne: true } }), 'tables');
const limitMembers   = checkPlanLimit('maxMembers',   (b) => UserBranchRole.countDocuments({ branchId: b, status: 'active' }),'staff members');
const limitCustomers = checkPlanLimit('maxCustomers', (b) => Customer.countDocuments({ branchId: b }),                        'customers');

module.exports = { 
  checkPlanLimit, 
  checkFeature,
  limitDishes, 
  limitTables, 
  limitMembers, 
  limitCustomers 
};
