const Role = require('../../models/users/Role');
const UserBranchRole = require('../../models/users/UserBranchRole');
const User = require('../../models/users/User');
const { DEFAULT_ROLE_PERMISSIONS, sanitizeRolePermissions } = require('../../utils/auth/permissions');

const DEFAULT_ROLE_SEEDS = [
  { name: 'superadmin', key: 'superadmin', color: '#0f172a' },
  { name: 'admin', key: 'admin', color: '#2563eb' },
  { name: 'waiter', key: 'waiter', color: '#ef4444' },
  { name: 'kitchen', key: 'kitchen', color: '#10b981' }
];

const ensureDefaultRoles = async (branchId) => {
  const existing = await Role.find({ branchId });
  for (const role of existing) {
    const normalized = (role.name || '').toLowerCase().trim();
    if (normalized && role.name !== normalized) {
      role.name = normalized;
      await role.save();
    }
    if (normalized && DEFAULT_ROLE_PERMISSIONS[normalized]) {
      const defaults = DEFAULT_ROLE_PERMISSIONS[normalized] || [];
      const current = Array.isArray(role.permissions) ? role.permissions : [];
      const needsStar = defaults.includes('*') && !current.includes('*');
      if (needsStar) {
        role.permissions = ['*'];
        role.isDefault = true;
        await role.save();
      } else if (!needsStar && defaults.length > 0) {
        role.permissions = Array.from(new Set([...defaults, ...current]));
        role.isDefault = true;
        await role.save();
      }
      if (role.isDefault !== true) {
        role.isDefault = true;
        await role.save();
      }
    }
  }
  const existingNames = new Set(existing.map((r) => (r.name || '').toLowerCase()));
  const created = [];
  for (const seed of DEFAULT_ROLE_SEEDS) {
    if (!existingNames.has(seed.name.toLowerCase())) {
      const role = await Role.create({
        branchId,
        name: seed.name.toLowerCase(),
        description: `${seed.name} default role`,
        color: seed.color,
        permissions: DEFAULT_ROLE_PERMISSIONS[seed.key] || [],
        isDefault: true
      });
      created.push(role);
    }
  }
  return [...existing, ...created];
};

const promoteAdminToSuperAdmin = async (req) => {
  if (!req.user || !req.branchId) return;
  const membership = await UserBranchRole.findOne({ userId: req.user._id, branchId: req.branchId });
  if (!membership) return;
  if (membership.role && membership.role.toLowerCase() === 'superadmin') return;
  if (membership.role && membership.role.toLowerCase() === 'admin') {
    membership.role = 'superadmin';
    membership.permissions = DEFAULT_ROLE_PERMISSIONS.superadmin || ['*'];
    await membership.save();
    await User.findByIdAndUpdate(req.user._id, { role: 'superadmin' });
  }
};

const listRoles = async (req, res) => {
  const branchId = req.branchId;
  const roles = await ensureDefaultRoles(branchId);
  await promoteAdminToSuperAdmin(req);
  const ownerExists = await UserBranchRole.findOne({ branchId, isOwner: true });
  if (!ownerExists) {
    const firstSuper = await UserBranchRole.findOne({ branchId, role: 'superadmin' }).sort({ createdAt: 1 });
    if (firstSuper) {
      firstSuper.isOwner = true;
      await firstSuper.save();
    }
  }
  const counts = await UserBranchRole.aggregate([
    { $match: { branchId } },
    { $group: { _id: '$role', total: { $sum: 1 } } }
  ]);
  const normalizedCounts = counts.map((row) => ({
    ...row,
    _id: (row._id || '').toLowerCase()
  }));
  return res.json({ roles, counts: normalizedCounts });
};

const createRole = async (req, res) => {
  const { name, description, color, permissions } = req.body;
  if (!name) return res.status(400).json({ message: 'Role name required' });
  const normalizedName = name.toLowerCase().trim();
  const existing = await Role.findOne({ branchId: req.branchId, name: normalizedName });
  if (existing) {
    return res.status(409).json({ message: 'Role name already exists in this branch' });
  }
  const role = await Role.create({
    branchId: req.branchId,
    name: normalizedName,
    description: description?.trim(),
    color: color || '#ef4444',
    permissions: sanitizeRolePermissions(normalizedName, permissions || [])
  });
  return res.status(201).json(role);
};

const updateRole = async (req, res) => {
  const update = { ...req.body };
  if (update.name) update.name = update.name.toLowerCase().trim();
  if (update.description) update.description = update.description.trim();
  const roleDoc = await Role.findOne({ _id: req.params.id, branchId: req.branchId });
  if (!roleDoc) return res.status(404).json({ message: 'Role not found' });

  const previousRoleName = roleDoc.name;
  const nextRoleName = update.name || previousRoleName;

  if (roleDoc.isDefault && update.name && update.name !== previousRoleName) {
    return res.status(400).json({ message: 'Default role name cannot be changed' });
  }

  if (update.name && update.name !== previousRoleName) {
    const duplicate = await Role.findOne({
      branchId: req.branchId,
      name: update.name,
      _id: { $ne: req.params.id }
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Role name already exists in this branch' });
    }
  }

  if (update.permissions) {
    update.permissions = sanitizeRolePermissions(nextRoleName, update.permissions);
  }

  Object.assign(roleDoc, update);
  await roleDoc.save();

  const membershipUpdate = {
    role: nextRoleName,
    permissions: sanitizeRolePermissions(nextRoleName, roleDoc.permissions || [])
  };

  const membershipDocs = await UserBranchRole.find({
    branchId: req.branchId,
    role: previousRoleName
  }).select('userId');

  await UserBranchRole.updateMany(
    { branchId: req.branchId, role: previousRoleName },
    membershipUpdate
  );

  const affectedUserIds = membershipDocs.map((membership) => membership.userId).filter(Boolean);
  if (affectedUserIds.length > 0) {
    await User.updateMany(
      { _id: { $in: affectedUserIds }, role: previousRoleName },
      { role: nextRoleName }
    );
  }

  return res.json(roleDoc);
};

const deleteRole = async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, branchId: req.branchId });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  if (role.isDefault || DEFAULT_ROLE_SEEDS.some((seed) => seed.name === role.name)) {
    return res.status(400).json({ message: 'Default roles cannot be deleted' });
  }
  const usersUsingRole = await UserBranchRole.countDocuments({ branchId: req.branchId, role: role.name });
  if (usersUsingRole > 0) {
    return res.status(400).json({ message: 'Cannot delete role while users are assigned to it' });
  }
  await Role.findByIdAndDelete(role._id);
  return res.json({ message: 'Role deleted' });
};

module.exports = { listRoles, createRole, updateRole, deleteRole };
