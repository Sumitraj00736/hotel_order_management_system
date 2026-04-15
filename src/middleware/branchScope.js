const UserBranchRole = require('../models/users/UserBranchRole');
const Branch = require('../models/core/Branch');

// Attaches branchId and branchRole to req based on header x-branch-id and user membership
const branchScope = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const requestedBranchId = req.header('x-branch-id');

  // Load memberships
  const memberships = await UserBranchRole.find({ userId: req.user._id, active: true });
  req.branchMemberships = memberships;

  // If no memberships recorded, allow legacy single-tenant behavior
  if (!memberships.length) {
    const fallbackBranch = await Branch.findOne();
    if (!fallbackBranch) {
      return res.status(403).json({ message: 'No branch memberships. Contact admin.' });
    }
    const { resolveRolePermissions } = require('../utils/permissions');
    await UserBranchRole.findOneAndUpdate(
      { userId: req.user._id, branchId: fallbackBranch._id },
      {
        userId: req.user._id,
        branchId: fallbackBranch._id,
        orgId: fallbackBranch.orgId,
        role: req.user.role,
        permissions: resolveRolePermissions({ roleName: req.user.role }),
        active: true
      },
      { upsert: true, new: true }
    );
    memberships = await UserBranchRole.find({ userId: req.user._id, active: true });
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
    return res.status(400).json({
      message: 'Select a branch',
      branches: memberships.map((m) => ({ branchId: m.branchId, role: m.role }))
    });
  }

  req.branchId = active.branchId;
  req.branchRole = active.role;
  req.branchPermissions = active.permissions || [];

  return next();
};

module.exports = branchScope;
