const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/users/User');
const Branch = require('../../models/core/Branch');
const Organization = require('../../models/core/Organization');
const UserBranchRole = require('../../models/users/UserBranchRole');
const { slugify } = require('../../utils/slugify');
const { logActivity } = require('../../utils/activity');
const { resolveRolePermissions } = require('../../utils/permissions');

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

    // ✅ 1. Mandatory field validation
    const missingFields = [];
    if (!name?.trim())     missingFields.push('name');
    if (!email?.trim())    missingFields.push('email');
    if (!phone?.trim())    missingFields.push('phone');
    if (!password?.trim()) missingFields.push('password');
    if (!cafeName?.trim()) missingFields.push('cafeName');

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // ✅ 2. Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    // ✅ 3. Password strength (min 6 chars)
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase();
    const normalizedPhone = phone.trim();

    // ✅ 4. Check email duplicate
    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    // ✅ 5. Check phone duplicate
    const phoneExists = await User.findOne({ phone: normalizedPhone });
    if (phoneExists) {
      return res.status(409).json({ message: 'Phone number is already registered' });
    }

    // ✅ Create new user (no conditional check needed now)
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashed,
      role: 'superadmin'
    });

    // create organization + branch for this cafe and attach user as admin
    const orgName = cafeName || `${name}`;
    const baseSlug = slugify(orgName) || 'cafe';
    let orgSlug = baseSlug;
    let suffix = 1;
    while (await Organization.findOne({ slug: orgSlug })) {
      orgSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
    const org = await Organization.create({ name: orgName, slug: orgSlug });
    const branch = await Branch.create({
      name: branchName || orgName,
      code: `${(branchName || orgName || 'main').toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString(36)}`,
      orgId: org._id
    });

    await UserBranchRole.findOneAndUpdate(
      { userId: user._id, branchId: branch._id },
      {
        userId: user._id,
        branchId: branch._id,
        orgId: org._id,
        role: 'superadmin',
        permissions: resolveRolePermissions({ roleName: 'superadmin' }),
        isOwner: true
      },
      { upsert: true, new: true }
    );

    await logActivity({
      branchId: branch._id,
      title: 'Restaurant created',
      type: 'Restaurant Created',
      description: `${user.name} created restaurant ${branch.name}`,
      performedBy: user._id
    });

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
 
    const allMemberships = await UserBranchRole.find({ userId: user._id })
      .populate('branchId', 'name code')
      .populate('orgId', 'name slug');

    const memberships = allMemberships.filter(
      (m) => m.status === 'active' || (m.status === undefined && m.active === true)
    );
    if (!memberships || memberships.length === 0) {
      const pendingMembership = allMemberships.find((m) => m.status === 'pending');
      const inactiveMembership = allMemberships.find((m) => m.status === 'inactive');
      const blocked = pendingMembership || inactiveMembership || allMemberships[0];
      return res.status(403).json({
        message: 'Account is pending or inactive',
        pendingUser: user.name,
        branchName: blocked?.branchId?.name || 'your branch',
        status: blocked?.status || 'inactive'
      });
    }
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
