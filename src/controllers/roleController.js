const Role = require('../models/Role');
const UserBranchRole = require('../models/UserBranchRole');
const User = require('../models/User');
const { DEFAULT_ROLE_PERMISSIONS } = require('../utils/permissions');

const DEFAULT_ROLE_SEEDS = [
  { name: 'Admin', key: 'admin', color: '#2563eb' },
  { name: 'Billing', key: 'billing', color: '#f97316' },
  { name: 'Kitchen', key: 'kitchen', color: '#10b981' },
  { name: 'Waiter', key: 'waiter', color: '#ef4444' },
  { name: 'SuperAdmin', key: 'superadmin', color: '#0f172a' }
];

const ensureDefaultRoles = async (branchId) => {
  const existing = await Role.find({ branchId });
  const existingNames = new Set(existing.map((r) => r.name));
  const created = [];
  for (const seed of DEFAULT_ROLE_SEEDS) {
    if (!existingNames.has(seed.name)) {
      const role = await Role.create({
        branchId,
        name: seed.name,
        description: `${seed.name} default role`,
        color: seed.color,
        permissions: DEFAULT_ROLE_PERMISSIONS[seed.key] || []
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
    membership.role = 'SuperAdmin';
    membership.permissions = DEFAULT_ROLE_PERMISSIONS.superadmin || ['*'];
    await membership.save();
    await User.findByIdAndUpdate(req.user._id, { role: 'superadmin' });
  }
};

const listRoles = async (req, res) => {
  const branchId = req.branchId;
  const roles = await ensureDefaultRoles(branchId);
  await promoteAdminToSuperAdmin(req);
  const counts = await UserBranchRole.aggregate([
    { $match: { branchId } },
    { $group: { _id: '$role', total: { $sum: 1 } } }
  ]);
  return res.json({ roles, counts });
};

const createRole = async (req, res) => {
  const { name, description, color, permissions } = req.body;
  if (!name) return res.status(400).json({ message: 'Role name required' });
  const role = await Role.create({
    branchId: req.branchId,
    name,
    description,
    color: color || '#ef4444',
    permissions: permissions || []
  });
  return res.status(201).json(role);
};

const updateRole = async (req, res) => {
  const role = await Role.findOneAndUpdate(
    { _id: req.params.id, branchId: req.branchId },
    { ...req.body },
    { new: true }
  );
  if (!role) return res.status(404).json({ message: 'Role not found' });
  return res.json(role);
};

const deleteRole = async (req, res) => {
  const role = await Role.findOneAndDelete({ _id: req.params.id, branchId: req.branchId });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  return res.json({ message: 'Role deleted' });
};

module.exports = { listRoles, createRole, updateRole, deleteRole };
