const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT secret missing');
  }
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
};

const register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { phone }] });
    if (existing) {
      return res.status(409).json({ message: 'Email or phone already in use' });
    }

    const totalUsers = await User.countDocuments();
    if (totalUsers > 0) {
      return res.status(403).json({ message: 'Registration closed. Ask admin to create accounts.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, phone, password: hashed, role: 'admin' });
    const token = createToken(user);
    return res.status(201).json({ token, user: { id: user._id, name, email, phone, role: user.role } });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, phone, identifier, password } = req.body;
    const loginValue = email || phone || identifier;
    const user = await User.findOne({ $or: [{ email: loginValue }, { phone: loginValue }] });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = createToken(user);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

module.exports = { register, login };
