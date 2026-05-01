const bcrypt = require('bcryptjs');
const User = require('../../models/users/User');
const UserBranchRole = require('../../models/users/UserBranchRole');
const Branch = require('../../models/core/Branch');
const Organization = require('../../models/core/Organization');
const Role = require('../../models/users/Role');
const DeletedUser = require('../../models/users/DeletedUser');
const { logActivity } = require('../../utils/notifications/activity');
const { resolveRolePermissions, normalizeRoleKey, sanitizeRolePermissions } = require('../../utils/auth/permissions');
const { normalizeEmail, normalizePhone } = require('../../utils/auth/identity');

const resolveRolePayload = async ({ branchId, roleName, roleId }) => {
  if (roleId) {
    const roleDoc = await Role.findOne({ _id: roleId, branchId });
    if (!roleDoc) return null;
    return { role: roleDoc.name, permissions: roleDoc.permissions || [] };
  }

  if (roleName) {
    const normalizedRole = normalizeRoleKey(roleName);
    const roleDoc = await Role.findOne({ branchId, name: normalizedRole });
    if (roleDoc) {
      return { role: roleDoc.name, permissions: roleDoc.permissions || [] };
    }
    return { role: normalizedRole, permissions: resolveRolePermissions({ roleName: normalizedRole }) };
  }

  return { role: undefined, permissions: [] };
};

const findBranchMembership = ({ branchId, userId }) =>
  UserBranchRole.findOne({ branchId, userId }).populate('userId');

const buildBranchScopedUserPayload = (membership) => {
  const user = membership?.userId;
  if (!membership || !user) return null;

  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: normalizeRoleKey(membership.role || user.role || ''),
    isOwner: !!membership.isOwner,
    status: membership.status || (membership.active ? 'active' : 'inactive'),
    dateOfJoining: user.dateOfJoining,
    salary: user.salary,
    shiftStart: user.shiftStart,
    shiftEnd: user.shiftEnd,
    profileImageUrl: user.profileImageUrl,
    citizenshipNumber: user.citizenshipNumber,
    citizenshipImageUrl: user.citizenshipImageUrl,
    address: user.address,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
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
  let users = memberships
    .map((m) => {
      const u = m.userId;
      if (!u) return null;
      
      const effectiveStatus = m.status || (m.isOwner ? 'active' : (m.active ? 'active' : 'inactive'));
      
      return {
        _id: u._id,
        id: u._id,
        name: u.name || u.email?.split('@')[0] || 'User',
        email: u.email,
        phone: u.phone,
        role: normalizeRoleKey(m.role || u.role || ''),
        isOwner: !!m.isOwner,
        status: effectiveStatus,
        dateOfJoining: u.dateOfJoining,
        salary: u.salary
      };
    })
    .filter(Boolean);

  // Fail-safe: If the list is empty but the current user is an admin/owner for this branch
  // ensure they at least see themselves
  if (users.length === 0 && req.user) {
    users.push({
      _id: req.user._id,
      id: req.user._id,
      name: req.user.name || 'Admin',
      email: req.user.email,
      role: 'superadmin',
      isOwner: true,
      status: 'active'
    });
  }

  return res.json(users);
};

const getUser = async (req, res) => {
  if (!req.branchId) {
    return res.status(400).json({ message: 'Branch required' });
  }

  const membership = await findBranchMembership({ branchId: req.branchId, userId: req.params.id });
  if (!membership?.userId) {
    return res.status(404).json({ message: 'User not found in this branch' });
  }
  return res.json(buildBranchScopedUserPayload(membership));
};

const createUser = async (req, res) => {
  try {
    const { name, email, phone, password, role, roleId, dateOfJoining, salary, shiftStart, shiftEnd, status } = req.body;
    if (!req.branchId) {
      return res.status(400).json({ message: 'Branch required to create user' });
    }

    const branch = await Branch.findById(req.branchId);
    if (!branch) return res.status(404).json({ message: 'Branch not found' });
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = phone ? normalizePhone(phone) : '';
    const existingLookup = [{ email: normalizedEmail }];
    if (normalizedPhone) existingLookup.push({ phone: normalizedPhone });
    const existing = await User.findOne({ $or: existingLookup });
    if (existing) {
      const existingMemberships = await UserBranchRole.find({ userId: existing._id });
      const crossOrgMembership = existingMemberships.find(
        (membership) => String(membership.orgId) !== String(branch.orgId)
      );
      if (crossOrgMembership) {
        return res.status(409).json({
          message: 'Existing account belongs to another organization. Cross-organization linking is disabled.'
        });
      }

      const membership = await UserBranchRole.findOne({ userId: existing._id, branchId: req.branchId, active: true });
      if (membership) return res.status(409).json({ message: 'User already exists in this branch' });
      const membershipStatus = status || 'active';
      const resolved = await resolveRolePayload({ branchId: req.branchId, roleName: role, roleId });
      await UserBranchRole.create({
        userId: existing._id,
        branchId: req.branchId,
        role: resolved?.role || (role ? normalizeRoleKey(role) : 'waiter'),
        permissions: sanitizeRolePermissions(
          resolved?.role || (role ? normalizeRoleKey(role) : 'waiter'),
          resolved?.permissions || []
        ),
        orgId: branch.orgId,
        status: membershipStatus,
        active: membershipStatus === 'active'
      });
      await logActivity({
        req,
        branchId: req.branchId,
        title: 'Staff invited',
        type: 'Staffs Invited',
        action: 'user.membership.create',
        description: `${req.user?.name || 'Admin'} invited ${existing.name || existing.email} with ${(role ? normalizeRoleKey(role) : 'staff')} role.`,
        performedBy: req.user?._id,
        entityType: 'user',
        entityId: existing._id,
        metadata: {
          status: membershipStatus,
          role: resolved?.role || (role ? normalizeRoleKey(role) : 'waiter')
        }
      });
      return res.status(201).json({
        _id: existing._id,
        id: existing._id,
        name: existing.name,
        email: existing.email,
        role: normalizeRoleKey((resolved?.role || role || existing.role || '').toString())
      });
    }
    const hashed = await bcrypt.hash(password, 10);
    const resolved = await resolveRolePayload({ branchId: req.branchId, roleName: role, roleId });
    const user = await User.create({
      name,
      email: normalizedEmail,
      phone: normalizedPhone || undefined,
      password: hashed,
      role: resolved?.role || (role ? normalizeRoleKey(role) : undefined),
      dateOfJoining,
      salary,
      shiftStart,
      shiftEnd
    });
    const membershipStatus = status || 'active';
    await UserBranchRole.create({
      userId: user._id,
      branchId: req.branchId,
      role: resolved?.role || (role ? normalizeRoleKey(role) : 'waiter'),
      permissions: sanitizeRolePermissions(
        resolved?.role || (role ? normalizeRoleKey(role) : 'waiter'),
        resolved?.permissions || []
      ),
      orgId: branch.orgId,
      status: membershipStatus,
      active: membershipStatus === 'active'
    });
    await logActivity({
      req,
      branchId: req.branchId,
      title: 'Staff invited',
      type: 'Staffs Invited',
      action: 'user.create',
      description: `${req.user?.name || 'Admin'} invited ${name} with ${(role ? normalizeRoleKey(role) : 'staff')} role.`,
      performedBy: req.user?._id,
      entityType: 'user',
      entityId: user._id,
      metadata: {
        status: membershipStatus,
        role: resolved?.role || (role ? normalizeRoleKey(role) : 'waiter')
      }
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
      req,
      branchId: req.branchId,
      title: 'Staff status updated',
      type: 'Staff Status',
      action: 'user.status.update',
      description: `${req.user?.name || 'Admin'} set ${memberUser?.name || memberUser?.email || 'staff'} to ${status}.`,
      performedBy: req.user?._id,
      entityType: 'user',
      entityId: req.params.id,
      metadata: {
        status
      }
    });
    return res.json({ message: 'Status updated', status });
  } catch (error) {
    return res.status(500).json({ message: 'Update user status failed', error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { name, email, phone, role, roleId, password, dateOfJoining, salary, shiftStart, shiftEnd } = req.body;
    if (!req.branchId) {
      return res.status(400).json({ message: 'Branch required' });
    }

    const membership = await UserBranchRole.findOne({ userId: req.params.id, branchId: req.branchId });
    if (!membership) {
      return res.status(404).json({ message: 'User not found in this branch' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const beforeSnapshot = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: membership?.role || user.role,
      dateOfJoining: user.dateOfJoining,
      salary: user.salary,
      shiftStart: user.shiftStart,
      shiftEnd: user.shiftEnd
    };
    if (membership?.isOwner && (role || roleId)) {
      return res.status(403).json({ message: 'Owner role cannot be changed' });
    }

    const normalizedEmail = email ? normalizeEmail(email) : undefined;
    const normalizedPhone = phone ? normalizePhone(phone) : undefined;
    if ((normalizedEmail && normalizedEmail !== user.email) || (normalizedPhone && normalizedPhone !== user.phone)) {
      // Check if new email/phone is taken by ANOTHER user
      const existing = await User.findOne({ 
        $or: [
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
        ], 
        _id: { $ne: user._id } 
      });
      
      if (existing) {
        return res.status(409).json({ message: 'Email or phone already in use by another account' });
      }
      if (normalizedEmail) user.email = normalizedEmail;
      if (normalizedPhone) user.phone = normalizedPhone;
    }

    if (name) user.name = name;
    if (role || roleId) {
      const resolved = await resolveRolePayload({ branchId: req.branchId, roleName: role, roleId });
      if (resolved?.role) {
        user.role = resolved.role;
        await UserBranchRole.findOneAndUpdate(
          { userId: user._id, branchId: req.branchId },
          {
            role: resolved.role,
            permissions: sanitizeRolePermissions(resolved.role, resolved.permissions || [])
          }
        );
      }
    }
    if (dateOfJoining) user.dateOfJoining = dateOfJoining;
    if (salary !== undefined) user.salary = salary;
    if (shiftStart) user.shiftStart = shiftStart;
    if (shiftEnd) user.shiftEnd = shiftEnd;
    if (password) user.password = await bcrypt.hash(password, 10);

    await user.save();
    await logActivity({
      req,
      branchId: req.branchId,
      title: 'Staff profile updated',
      type: 'Staff Profile',
      action: 'user.update',
      description: `${req.user?.name || 'Admin'} updated ${user.name || user.email}.`,
      performedBy: req.user?._id,
      entityType: 'user',
      entityId: user._id,
      metadata: {
        before: beforeSnapshot,
        after: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: membership?.role || user.role,
          dateOfJoining: user.dateOfJoining,
          salary: user.salary,
          shiftStart: user.shiftStart,
          shiftEnd: user.shiftEnd
        }
      }
    });
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
    if (membership.isOwner) {
      return res.status(403).json({ message: 'Owner role cannot be changed' });
    }
    membership.role = resolved.role;
    membership.permissions = sanitizeRolePermissions(resolved.role, resolved.permissions || []);
    await membership.save();

    const user = await User.findById(req.params.id);
    if (user) {
      user.role = resolved.role;
      await user.save();
    }

    await logActivity({
      req,
      branchId: req.branchId,
      title: 'Staff role updated',
      type: 'Staff Role',
      action: 'user.role.update',
      description: `${req.user?.name || 'Admin'} set ${user?.name || 'staff'} to role ${resolved.role}.`,
      performedBy: req.user?._id,
      entityType: 'user',
      entityId: req.params.id,
      metadata: {
        role: resolved.role,
        permissions: membership.permissions || []
      }
    });

    return res.json({ message: 'Role updated', role: resolved.role, permissions: resolved.permissions || [] });
  } catch (error) {
    return res.status(500).json({ message: 'Update role failed', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  if (!req.branchId) {
    return res.status(400).json({ message: 'Branch required' });
  }

  const actorRole = normalizeRoleKey(req.branchRole || req.user?.role || '');
  if (actorRole !== 'superadmin') {
    return res.status(403).json({ message: 'Only superadmin can delete users' });
  }
  const membership = await UserBranchRole.findOne({ userId: req.params.id, branchId: req.branchId });
  if (membership?.isOwner) {
    return res.status(403).json({ message: 'Owner cannot be deleted' });
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const branch = req.branchId ? await Branch.findById(req.branchId).lean() : null;
  const org = branch?.orgId ? await Organization.findById(branch.orgId).lean() : null;

  await DeletedUser.create({
    userId: user._id,
    branchId: req.branchId,
    orgId: membership?.orgId,
    branchName: branch?.name,
    orgName: org?.name,
    deletedBy: req.user._id,
    snapshot: {
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: membership?.status,
      dateOfJoining: user.dateOfJoining,
      salary: user.salary,
      shiftStart: user.shiftStart,
      shiftEnd: user.shiftEnd
    },
    membership: membership
      ? {
          role: membership.role,
          permissions: membership.permissions || [],
          status: membership.status,
          active: membership.active,
          isOwner: membership.isOwner
        }
      : undefined
  });

  if (membership) {
    await UserBranchRole.findByIdAndDelete(membership._id);
  }

  const remaining = await UserBranchRole.countDocuments({ userId: user._id });
  if (remaining === 0) {
    await User.findByIdAndDelete(user._id);
  }

  await logActivity({
    req,
    branchId: req.branchId,
    title: 'Staff deleted',
    type: 'Staff Delete',
    action: 'user.delete',
    description: `${req.user?.name || 'Admin'} deleted ${user.name || user.email}.`,
    performedBy: req.user?._id,
    entityType: 'user',
    entityId: user._id,
    metadata: {
      branchName: branch?.name,
      orgName: org?.name,
      archived: true
    }
  });

  return res.json({ message: 'User deleted', archived: true });
};

module.exports = { listUsers, getUser, createUser, updateUser, deleteUser, updateUserStatus, updateUserRole };
