const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserBranchRole = require('../models/UserBranchRole');
const Branch = require('../models/Branch');
const Role = require('../models/Role');
const { logActivity } = require('../utils/activity');
const { resolveRolePermissions } = require('../utils/permissions');

const resolveRolePayload = async ({ branchId, roleName, roleId }) => {
  if (roleId) {
    const roleDoc = await Role.findOne({ _id: roleId, branchId });
    if (!roleDoc) return null;
    return { role: roleDoc.name, permissions: roleDoc.permissions || [] };
  }

  if (roleName) {
    const roleDoc = await Role.findOne({ branchId, name: roleName });
    if (roleDoc) {
      return { role: roleDoc.name, permissions: roleDoc.permissions || [] };
    }
    return { role: roleName, permissions: resolveRolePermissions({ roleName }) };
  }

  return { role: undefined, permissions: [] };
};

const listUsers = async (req, res) => {
  if (!req.branchId) {
    return res.status(400).json({ message: 'Branch required' });
  }
  const statusFilter = req.query.status;
  const membershipFilter = { branchId: req.branchId };
  if (statusFilter) {
    membershipFilter.status = statusFilter;
  }
  const memberships = await UserBranchRole.find(membershipFilter).populate('userId');
  const users = memberships
    .map((m) => {
      const u = m.userId;
      if (!u) return null;
      return {
        _id: u._id,
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: m.role,
        status: m.status || (m.active ? 'active' : 'inactive'),
        dateOfJoining: u.dateOfJoining,
        salary: u.salary,
        shiftStart: u.shiftStart,
        shiftEnd: u.shiftEnd
      };
    })
    .filter(Boolean);
  return res.json(users);
};

const getUser = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json(user);
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, roleId, dateOfJoining, salary, shiftStart, shiftEnd, status } = req.body;
    if (!req.branchId) {
      return res.status(400).json({ message: 'Branch required to create user' });
    }

    const branch = await Branch.findById(req.branchId);
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      const membership = await UserBranchRole.findOne({ userId: existing._id, branchId: req.branchId, active: true });
      if (membership) return res.status(409).json({ message: 'User already exists in this branch' });
      const hashedExisting = existing.password; // reuse stored hash
      const membershipStatus = status || 'active';
      const resolved = await resolveRolePayload({ branchId: req.branchId, roleName: role, roleId });
      await UserBranchRole.create({
        userId: existing._id,
        branchId: req.branchId,
        role: resolved?.role || role || 'waiter',
        permissions: resolved?.permissions || [],
        orgId: branch.orgId,
        status: membershipStatus,
        active: membershipStatus === 'active'
      });
      await logActivity({
        branchId: req.branchId,
        title: 'Staff invited',
        type: 'Staffs Invited',
        description: `${req.user?.name || 'Admin'} invited ${existing.name || existing.email} with ${role || 'staff'} role.`,
        performedBy: req.user?._id
      });
      return res.status(201).json({ _id: existing._id, id: existing._id, name: existing.name, email: existing.email, role });
    }
    const hashed = await bcrypt.hash(password, 10);
    const resolved = await resolveRolePayload({ branchId: req.branchId, roleName: role, roleId });
    const user = await User.create({
      name,
      email,
      phone,
      password: hashed,
      role: resolved?.role || role,
      dateOfJoining,
      salary,
      shiftStart,
      shiftEnd
    });
    const membershipStatus = status || 'active';
    await UserBranchRole.create({
      userId: user._id,
      branchId: req.branchId,
      role: resolved?.role || role || 'waiter',
      permissions: resolved?.permissions || [],
      orgId: branch.orgId,
      status: membershipStatus,
      active: membershipStatus === 'active'
    });
    await logActivity({
      branchId: req.branchId,
      title: 'Staff invited',
      type: 'Staffs Invited',
      description: `${req.user?.name || 'Admin'} invited ${name} with ${role || 'staff'} role.`,
      performedBy: req.user?._id
    });
    return res.status(201).json({ _id: user._id, id: user._id, name, email, role: user.role });
  } catch (error) {
    return res.status(500).json({ message: 'Create user failed', error: error.message });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!req.branchId) return res.status(400).json({ message: 'Branch required' });
    if (!status || !['active', 'pending', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const membership = await UserBranchRole.findOne({ userId: req.params.id, branchId: req.branchId });
    if (!membership) return res.status(404).json({ message: 'User membership not found' });
    membership.status = status;
    membership.active = status === 'active';
    await membership.save();
    const memberUser = await User.findById(req.params.id).select('name email');
    await logActivity({
      branchId: req.branchId,
      title: 'Staff status updated',
      type: 'Staff Status',
      description: `${req.user?.name || 'Admin'} set ${memberUser?.name || memberUser?.email || 'staff'} to ${status}.`,
      performedBy: req.user?._id
    });
    return res.json({ message: 'Status updated', status });
  } catch (error) {
    return res.status(500).json({ message: 'Update user status failed', error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, roleId, password, dateOfJoining, salary, shiftStart, shiftEnd } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if ((email && email !== user.email) || (phone && phone !== user.phone)) {
      const existing = await User.findOne({ $or: [{ email }, { phone }] });
      if (existing) {
        return res.status(409).json({ message: 'Email or phone already in use' });
      }
      if (email) user.email = email;
      if (phone) user.phone = phone;
    }

    if (name) user.name = name;
    if (role || roleId) {
      const resolved = await resolveRolePayload({ branchId: req.branchId, roleName: role, roleId });
      if (resolved?.role) {
        user.role = resolved.role;
        await UserBranchRole.findOneAndUpdate(
          { userId: user._id, branchId: req.branchId },
          { role: resolved.role, permissions: resolved.permissions || [] }
        );
      }
    }
    if (dateOfJoining) user.dateOfJoining = dateOfJoining;
    if (salary !== undefined) user.salary = salary;
    if (shiftStart) user.shiftStart = shiftStart;
    if (shiftEnd) user.shiftEnd = shiftEnd;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    return res.json({ _id: user._id, id: user._id, name: user.name, email: user.email, role: user.role });
  } catch (error) {
    return res.status(500).json({ message: 'Update user failed', error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { roleId, roleName } = req.body;
    if (!req.branchId) return res.status(400).json({ message: 'Branch required' });
    const resolved = await resolveRolePayload({ branchId: req.branchId, roleName, roleId });
    if (!resolved || !resolved.role) {
      return res.status(400).json({ message: 'Role not found' });
    }

    const membership = await UserBranchRole.findOne({ userId: req.params.id, branchId: req.branchId });
    if (!membership) return res.status(404).json({ message: 'User membership not found' });
    membership.role = resolved.role;
    membership.permissions = resolved.permissions || [];
    await membership.save();

    const user = await User.findById(req.params.id);
    if (user) {
      user.role = resolved.role;
      await user.save();
    }

    await logActivity({
      branchId: req.branchId,
      title: 'Staff role updated',
      type: 'Staff Role',
      description: `${req.user?.name || 'Admin'} set ${user?.name || 'staff'} to role ${resolved.role}.`,
      performedBy: req.user?._id
    });

    return res.json({ message: 'Role updated', role: resolved.role, permissions: resolved.permissions || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Update role failed', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json({ message: 'User deleted' });
};

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, updateUserStatus, updateUserRole };
