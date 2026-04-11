const Role = require('../models/Role');
const UserBranchRole = require('../models/UserBranchRole');
const User = require('../models/User');
const { DEFAULT_ROLE_PERMISSIONS, sanitizeRolePermissions } = require('../utils/permissions');

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
      } else if (!needsStar && current.length === 0 && defaults.length > 0) {
        role.permissions = defaults;
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
  if (update.permissions) {
    const roleDoc = await Role.findOne({ _id: req.params.id, branchId: req.branchId }).select('name');
    if (roleDoc?.name) {
      update.permissions = sanitizeRolePermissions(roleDoc.name, update.permissions);
    }
  }
  const role = await Role.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    update,
    { new: true }
  );
  if (!role) return res.status(404).json({ message: 'Role not found' });
  return res.json(role);
};

const deleteRole = async (req, res) => {
  const role = await Role.findOne({ _id: req.params.id, branchId: req.branchId });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  if (role.isDefault || DEFAULT_ROLE_SEEDS.some((seed) => seed.name === role.name)) {
    return res.status(400).json({ message: 'Default roles cannot be deleted' });
  }
  await Role.findByIdAndDelete(role._id);
  return res.json({ message: 'Role deleted' });
};

module.exports = { listRoles, createRole, updateRole, deleteRole };
