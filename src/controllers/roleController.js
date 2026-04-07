const Role = require('../models/Role');
const UserBranchRole = require('../models/UserBranchRole');

const listRoles = async (req, res) => {
  const branchId = req.branchId;
  const roles = await Role.find({ branchId }).sort({ createdAt: 1 });
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
