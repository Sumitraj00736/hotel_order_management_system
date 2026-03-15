const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Organization = require('../models/Organization');
const UserBranchRole = require('../models/UserBranchRole');
const { slugify } = require('../utils/slugify');

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
    const { name, email, phone, password, cafeName, branchName } = req.body;
    const normalizedEmail = email?.toLowerCase();
    const normalizedPhone = phone?.trim();
    let user = await User.findOne({
      $or: [
        normalizedEmail ? { email: normalizedEmail } : null,
        normalizedPhone ? { phone: normalizedPhone } : null
      ].filter(Boolean)
    });

    if (!user) {
      if (!password || !name) {
        return res.status(400).json({ message: 'Name and password are required for new cafe registration' });
      }
      const hashed = await bcrypt.hash(password, 10);
      user = await User.create({ name, email: normalizedEmail, phone: normalizedPhone, password: hashed, role: 'admin' });
    }

    // create organization + branch for this cafe and attach user as admin
    const orgName = cafeName || `${name || user.name}'s Cafe`;
    const baseSlug = slugify(orgName) || 'cafe';
    let orgSlug = baseSlug;
    let suffix = 1;
    // Ensure unique slug for public URL
    while (await Organization.findOne({ slug: orgSlug })) {
      orgSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    const org = await Organization.create({ name: orgName, slug: orgSlug });
    const branch = await Branch.create({
      name: branchName || orgName,
      code: `${(branchName || orgName || 'main').toLowerCase().replace(/\\s+/g, '-')}-${Date.now().toString(36)}`,
      orgId: org._id
    });
    await UserBranchRole.findOneAndUpdate(
      { userId: user._id, branchId: branch._id },
      { userId: user._id, branchId: branch._id, orgId: org._id, role: 'admin' },
      { upsert: true, new: true }
    );

    // refresh memberships list
    const memberships = await UserBranchRole.find({ userId: user._id, active: true })
      .populate('branchId', 'name code')
      .populate('orgId', 'name slug');
    const branches = memberships.map((m) => ({
      branchId: m.branchId?._id || m.branchId,
      branchName: m.branchId?.name,
      code: m.branchId?.code,
      orgName: m.orgId?.name,
      orgSlug: m.orgId?.slug,
      role: m.role,
      permissions: m.permissions
    }));

    const token = createToken(user);
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      branches
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(409).json({ message: `${field} already in use` });
    }
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

    const memberships = await UserBranchRole.find({ userId: user._id, active: true })
      .populate('branchId', 'name code')
      .populate('orgId', 'name slug');
    const branches = memberships.map((m) => ({
      branchId: m.branchId?._id || m.branchId,
      branchName: m.branchId?.name,
      code: m.branchId?.code,
      orgName: m.orgId?.name,
      orgSlug: m.orgId?.slug,
      role: m.role,
      permissions: m.permissions
    }));

    const token = createToken(user);
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      branches
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

module.exports = { register, login };
