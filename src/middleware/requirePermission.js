const { DEFAULT_ROLE_PERMISSIONS, normalizeRoleKey } = require('../utils/permissions');

const requirePermission = (...required) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const branchRole = normalizeRoleKey(req.branchRole || req.user.role || '');
  const explicit = Array.isArray(req.branchPermissions) ? req.branchPermissions : [];
  const fallback = explicit.length ? explicit : DEFAULT_ROLE_PERMISSIONS[branchRole] || [];
  const permissions = fallback.map((p) => p.toLowerCase());

  if (permissions.includes('*')) {
    return next();
  }

  if (!required.length) {
    return next();
  }

  const allowed = required.some((perm) => permissions.includes(perm.toLowerCase()));
  if (allowed) {
    return next();
  }

  return res.status(403).json({ message: 'Forbidden' });
};

module.exports = requirePermission;
