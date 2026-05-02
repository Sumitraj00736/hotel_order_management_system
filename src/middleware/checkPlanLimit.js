const Subscription = require('../models/core/Subscription');
const MenuItem = require('../models/menu/MenuItem');
const Table = require('../models/tables/Table');
const UserBranchRole = require('../models/users/UserBranchRole');
const Customer = require('../models/customers/Customer');

/**
 * Factory: creates middleware that checks a specific plan limit before creation.
 * @param {string} limitKey - Field on Subscription (e.g. 'maxDishes')
 * @param {Function} countFn - async (branchId) => number
 * @param {string} resourceLabel - Human-friendly resource name for the error message
 */
const checkPlanLimit = (limitKey, countFn, resourceLabel) => async (req, res, next) => {
  try {
    const branchId = req.branchId;
    if (!branchId) return next();

    const subscription = await Subscription.findOne({ branchId }).lean();
    if (!subscription) return next();

    const limit = subscription[limitKey];
    if (typeof limit !== 'number' || limit <= 0) return next(); // 0 or null = unlimited

    const currentCount = await countFn(branchId);
    if (currentCount >= limit) {
      return res.status(403).json({
        code: 'PLAN_LIMIT_REACHED',
        message: `Your plan allows a maximum of ${limit} ${resourceLabel}. Please upgrade your subscription to add more.`,
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
    return next(); // fail open — never block on an error
  }
};

// Pre-built checkers
const limitDishes   = checkPlanLimit('maxDishes',   (b) => MenuItem.countDocuments({ branchId: b }),                         'menu items');
const limitTables   = checkPlanLimit('maxTables',   (b) => Table.countDocuments({ branchId: b, isTrashed: { $ne: true } }), 'tables');
const limitMembers  = checkPlanLimit('maxMembers',  (b) => UserBranchRole.countDocuments({ branchId: b, status: 'active' }),'staff members');
const limitCustomers= checkPlanLimit('maxCustomers',(b) => Customer.countDocuments({ branchId: b }),                        'customers');

module.exports = { checkPlanLimit, limitDishes, limitTables, limitMembers, limitCustomers };
