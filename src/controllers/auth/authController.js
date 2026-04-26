const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../models/users/User');
const Branch = require('../../models/core/Branch');
const Organization = require('../../models/core/Organization');
const UserBranchRole = require('../../models/users/UserBranchRole');
const { slugify } = require('../../utils/common/slugify');
const { logActivity } = require('../../utils/notifications/activity');
const { resolveRolePermissions } = require('../../utils/auth/permissions');
const { initFirebase, admin } = require('../../utils/firebase/admin');
const { normalizeEmail, normalizePhone, resolveLoginIdentifier } = require('../../utils/auth/identity');

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
    const { name, email, phone, password, cafeName, branchName, firebaseUid } = req.body;

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

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

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

    // ✅ Create new user
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password: hashed,
      role: 'superadmin',
      firebaseUid: firebaseUid || undefined
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
        isOwner: true,
        status: 'active',
        active: true
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
    const loginIdentity = resolveLoginIdentifier({ email, phone, identifier });
    if (!loginIdentity.lookup.length || !password) {
      return res.status(400).json({ message: 'Identifier and password are required' });
    }

    const user = await User.findOne({ $or: loginIdentity.lookup });
    if (!user) {
      req.log?.warn('Login rejected for unknown account', { loginType: loginIdentity.type });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.password) {
      req.log?.warn('Login rejected for passwordless account', { userId: user._id.toString() });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.log?.warn('Login rejected for invalid password', { userId: user._id.toString() });
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

    // Determine effective role (Elevate to superadmin if an owner)
    const effectiveRole = memberships.some(m => m.isOwner) ? 'superadmin' : (user.role || 'staff');

    const token = createToken(user);
    req.log?.info('Login successful', { userId: user._id.toString(), branches: branches.length });
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: effectiveRole },
      branches
    });
  } catch (error) {
    req.log?.error('Login failed', { error });
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

const firebaseLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: 'Token required' });

    const app = initFirebase();
    const decodedToken = await admin.auth(app).verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    let user = await User.findOne({ firebaseUid: uid });
    if (!user && email) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        user.firebaseUid = uid;
        if ((!user.name || user.name === 'User') && name) {
          user.name = name;
        }
        await user.save();
      }
    }

    if (!user) {
      return res.status(401).json({ 
        message: 'Account not linked to staff record', 
        code: 'USER_NOT_LINKED',
        firebaseUid: uid 
      });
    }

    const allMemberships = await UserBranchRole.find({ userId: user._id })
      .populate('branchId', 'name code')
      .populate('orgId', 'name slug');
    const memberships = allMemberships.filter(
      (m) => m.status === 'active' || (m.status === undefined && m.active === true)
    );
    if (!memberships.length) {
      const blocked = allMemberships.find((m) => m.status === 'pending' || m.status === 'inactive') || allMemberships[0];
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

    // Determine effective role (Elevate to superadmin if an owner)
    const effectiveRole = memberships.some(m => m.isOwner) ? 'superadmin' : (user.role || 'staff');

    return res.json({
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: effectiveRole, picture },
      branches
    });
  } catch (error) {
    const status = error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error' ? 401 : 500;
    req.log?.error('Firebase login failed', { error });
    return res.status(status).json({ message: 'Firebase login failed', error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: normalizeEmail(email) });

    if (!user) {
      // For security, don't reveal if user exists or not
      return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
    }

    // Generate token
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Create reset URL (pointing to frontend)
    const { env } = require('../../config/env');
    const resetUrl = `${env.frontendUrl}/reset-password/${resetToken}`;

    // Note: In production, use a real email service
    req.log?.info('Password reset token issued', {
      targetUserId: user._id.toString(),
      delivery: process.env.EMAIL_USER && process.env.EMAIL_PASS ? 'email' : 'development-link'
    });

    try {
      const nodemailer = require('nodemailer');
      // Configuration for nodemailer (Placeholder - user needs to provide credentials)
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const mailOptions = {
        to: user.email,
        from: 'HotelOms <noreply@hoteloms.com>',
        subject: 'Reset your HotelOms password',
        html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 40px 20px; border-radius: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #0f172a; margin: 0; font-size: 28px; font-weight: 800;">HotelOms</h1>
              <p style="color: #64748b; font-size: 14px;">Secure Management Solutions</p>
            </div>
            
            <div style="background-color: #ffffff; padding: 40px; border-radius: 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Password Reset Request</h2>
              <p style="color: #475569; line-height: 1.6; font-size: 16px;">
                You told us you lost your password. No worries! Click the button below to set up a new one and get back into your dashboard.
              </p>
              
              <div style="text-align: center; margin: 35px 0;">
                <a href="${resetUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; transition: background-color 0.2s;">
                  Reset My Password
                </a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
                This link will expires in 60 minutes for your security. 
                If you didn't ask for this, you can just ignore this email.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px;">
              <p>© 2024 HotelOms. All rights reserved.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      // In development we also return the URL so it can be tested without email delivery.
      res.status(200).json({
        message: 'Reset link sent to email',
        ...(env.nodeEnv !== 'production' ? { resetUrl } : {})
      });
    } catch (err) {
      req.log?.warn('Password reset email delivery failed', { error: err });
      // Do not leak existence in production. In development return the resetUrl for easy testing.
      res.status(200).json({
        message: 'If an account exists, a reset link has been sent.',
        ...(env.nodeEnv !== 'production' ? { resetUrl } : {})
      });
    }

  } catch (error) {
    req.log?.error('Forgot password request failed', { error });
    res.status(500).json({ message: 'Error in forgot password request', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const crypto = require('crypto');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password for MongoDB (Legacy fallback)
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    
    // Best-effort Firebase password sync:
    // - If firebaseUid exists: update by UID
    // - Else: try to find Firebase user by email and then update + backfill firebaseUid
    try {
      const { initFirebase, admin, isConfigured } = require('../../utils/firebase/admin');
      if (isConfigured()) {
        const app = initFirebase();
        const auth = admin.auth(app);

        let firebaseUid = user.firebaseUid;
        if (!firebaseUid && user.email) {
          try {
            const fbUser = await auth.getUserByEmail(user.email);
            firebaseUid = fbUser.uid;
            user.firebaseUid = fbUser.uid;
          } catch (_) {
            // Not a Firebase user - ignore.
          }
        }

        if (firebaseUid) {
          await auth.updateUser(firebaseUid, { password });
          req.log?.info('Firebase password synced after reset', { firebaseUid });
        }
      }
    } catch (fbError) {
      req.log?.warn('Firebase password sync failed after reset', { error: fbError });
      // Continue: Mongo password reset still succeeds.
    }

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.log?.info('Password reset successful', { userId: user._id.toString() });
    res.status(200).json({ message: 'Password reset successful. You can now login.' });
  } catch (error) {
    req.log?.error('Password reset failed', { error });
    res.status(500).json({ message: 'Error in password reset', error: error.message });
  }
};

const checkPhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    // Normalize: remove +, search for variations
    const cleanPhone = normalizePhone(phone);
    
    const user = await User.findOne({ 
      $or: [
        { phone: String(phone).trim() },
        { phone: cleanPhone }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'This phone number is not registered as staff.' });
    }

    return res.status(200).json({ message: 'User found', name: user.name });
  } catch (error) {
    return res.status(500).json({ message: 'Error checking phone', error: error.message });
  }
};

module.exports = { register, login, firebaseLogin, forgotPassword, resetPassword, checkPhone };
