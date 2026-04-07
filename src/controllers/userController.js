const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserBranchRole = require('../models/UserBranchRole');
const Branch = require('../models/Branch');

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
    const { name, email, phone, password, role, dateOfJoining, salary, shiftStart, shiftEnd, status } = req.body;
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
      await UserBranchRole.create({
        userId: existing._id,
        branchId: req.branchId,
        role,
        orgId: branch.orgId,
        status: membershipStatus,
        active: membershipStatus === 'active'
      });
      return res.status(201).json({ _id: existing._id, id: existing._id, name: existing.name, email: existing.email, role });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      phone,
      password: hashed,
      role,
      dateOfJoining,
      salary,
      shiftStart,
      shiftEnd
    });
    const membershipStatus = status || 'active';
    await UserBranchRole.create({
      userId: user._id,
      branchId: req.branchId,
      role,
      orgId: branch.orgId,
      status: membershipStatus,
      active: membershipStatus === 'active'
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
    return res.json({ message: 'Status updated', status });
  } catch (error) {
    return res.status(500).json({ message: 'Update user status failed', error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, password, dateOfJoining, salary, shiftStart, shiftEnd } = req.body;
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
    if (role) user.role = role;
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

const deleteUser = async (req, res) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  return res.json({ message: 'User deleted' });
};

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, updateUserStatus };
