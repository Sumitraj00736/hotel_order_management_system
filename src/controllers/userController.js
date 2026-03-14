const bcrypt = require('bcryptjs');
const User = require('../models/User');

const listUsers = async (req, res) => {
  const users = await User.find().select('-password');
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
    const { name, email, phone, password, role, dateOfJoining, salary, shiftStart, shiftEnd } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({ message: 'Email or phone already in use' });
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
    return res.status(201).json({ id: user._id, name, email, role: user.role });
  } catch (error) {
    return res.status(500).json({ message: 'Create user failed', error: error.message });
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
    return res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
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

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser };
