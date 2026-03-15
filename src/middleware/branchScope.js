const UserBranchRole = require('../models/UserBranchRole');

// Attaches branchId and branchRole to req based on header x-branch-id and user membership
const branchScope = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const requestedBranchId = req.header('x-branch-id');

  // Load memberships
  const memberships = await UserBranchRole.find({ userId: req.user._id, active: true });
  req.branchMemberships = memberships;

  // If no memberships recorded, allow legacy single-tenant behavior
  if (!memberships.length) {
    req.branchId = requestedBranchId || null;
    return next();
  }

  // Choose branch: header > single membership > error
  let active = null;
  if (requestedBranchId) {
    active = memberships.find((m) => m.branchId.toString() === requestedBranchId);
    if (!active) {
      return res.status(403).json({ message: 'Branch access denied' });
    }
  } else if (memberships.length === 1) {
    active = memberships[0];
  } else {
    // fallback to first membership to avoid blocking legacy clients
    [active] = memberships;
  }

  req.branchId = active.branchId;
  req.branchRole = active.role;
  req.branchPermissions = active.permissions || [];

  return next();
};

module.exports = branchScope;
