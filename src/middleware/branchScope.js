const UserBranchRole = require('../models/users/UserBranchRole');
const { pickActiveMembership } = require('../utils/branch/access');

// Attaches branchId and branchRole to req based on header x-branch-id and user membership
const branchScope = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

  const requestedBranchId = req.header('x-branch-id');

  // Load memberships
  let memberships = await UserBranchRole.find({
    userId: req.user._id,
    $or: [{ active: true }, { status: 'active' }]
  });
  req.branchMemberships = memberships;

  if (!memberships.length) {
    return res.status(403).json({ message: 'No active branch membership. Contact admin.' });
  }

  const branchAccess = pickActiveMembership({
    memberships: memberships.map((m) => ({
      branchId: m.branchId?.toString?.() || m.branchId,
      role: m.role,
      permissions: m.permissions || [],
      active: m.active,
      status: m.status
    })),
    requestedBranchId
  });
  if (branchAccess.error) {
    return res.status(branchAccess.error === 'Select a branch' ? 400 : 403).json({
      message: branchAccess.error,
      ...(branchAccess.branches ? { branches: branchAccess.branches } : {})
    });
  }
  const active = memberships.find(
    (m) => String(m.branchId) === String(branchAccess.active.branchId)
  );

  req.branchId = active.branchId;
  req.branchRole = active.role;
  req.branchPermissions = active.permissions || [];
  req.orgId = active.orgId;

  return next();
};

module.exports = branchScope;
