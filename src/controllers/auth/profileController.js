const SalesInvoice = require('../../models/finance/SalesInvoice');
const Branch = require('../../models/core/Branch');
const { buildSelfProfileEditPolicy } = require('../../utils/auth/profileAccess');

const getProfile = async (req, res) => {
  const user = req.user;
  let activeBranch = null;

  if (req.branchId) {
    activeBranch = await Branch.findById(req.branchId).select('name code address active').lean();
  }

  const editPolicy = buildSelfProfileEditPolicy(user, {
    branchRole: req.branchRole,
    permissions: req.branchPermissions || []
  });

  return res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    profileImageUrl: user.profileImageUrl || '',
    citizenshipNumber: user.citizenshipNumber || '',
    citizenshipImageUrl: user.citizenshipImageUrl || '',
    address: user.address || '',
    emergencyContactName: user.emergencyContactName || '',
    emergencyContactPhone: user.emergencyContactPhone || '',
    role: user.role,
    dateOfJoining: user.dateOfJoining,
    salary: user.salary,
    shiftStart: user.shiftStart,
    shiftEnd: user.shiftEnd,
    branch: activeBranch
      ? {
          id: activeBranch._id,
          name: activeBranch.name,
          code: activeBranch.code || '',
          address: activeBranch.address || '',
          active: activeBranch.active !== false
        }
      : null,
    branchRole: req.branchRole || null,
    permissions: req.branchPermissions || [],
    editPolicy,
    memberships: (req.branchMemberships || []).map((membership) => ({
      id: membership._id,
      branchId: membership.branchId,
      role: membership.role,
      status: membership.status,
      active: membership.active,
      isOwner: membership.isOwner === true
    }))
  });
};

const updateProfile = async (req, res) => {
  const user = req.user;
  const editPolicy = buildSelfProfileEditPolicy(user, {
    branchRole: req.branchRole,
    permissions: req.branchPermissions || []
  });

  const updates = {
    name: req.body.name?.trim(),
    phone: req.body.phone?.trim(),
    profileImageUrl: req.body.profileImageUrl?.trim(),
    citizenshipNumber: req.body.citizenshipNumber?.trim(),
    citizenshipImageUrl: req.body.citizenshipImageUrl?.trim(),
    address: req.body.address?.trim(),
    emergencyContactName: req.body.emergencyContactName?.trim(),
    emergencyContactPhone: req.body.emergencyContactPhone?.trim()
  };

  const blockedFields = Object.entries(updates)
    .filter(([key, value]) => value !== undefined && editPolicy.editableFields[key] === false)
    .map(([key]) => key);

  if (blockedFields.length) {
    return res.status(403).json({
      message: 'Some profile fields are locked and require admin approval to change.',
      blockedFields
    });
  }

  if (updates.phone && updates.phone !== user.phone) {
    const existing = await user.constructor.findOne({
      phone: updates.phone,
      _id: { $ne: user._id }
    });
    if (existing) {
      return res.status(409).json({ message: 'Phone already in use by another account' });
    }
  }

  if (updates.citizenshipNumber && updates.citizenshipNumber !== user.citizenshipNumber) {
    const existingCitizenship = await user.constructor.findOne({
      citizenshipNumber: updates.citizenshipNumber,
      _id: { $ne: user._id }
    });
    if (existingCitizenship) {
      return res.status(409).json({ message: 'Citizenship number already linked to another account' });
    }
  }

  const mutableFields = Object.entries(updates).filter(
    ([key, value]) => value !== undefined && editPolicy.editableFields[key] !== false
  );
  mutableFields.forEach(([key, value]) => {
    user[key] = value;
  });

  await user.save();
  req.user = user;
  return getProfile(req, res);
};

const getWaiterAnalytics = async (req, res) => {
  const waiterId = req.user._id;
  const match = { waiterId, status: 'active' };
  if (req.branchId) match.branchId = req.branchId;
  const agg = await SalesInvoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$grandTotal' },
        totalOrders: { $sum: 1 }
      }
    }
  ]);
  const summary = agg[0] || { totalSales: 0, totalOrders: 0 };

  return res.json({
    summary,
    note: 'More detailed charts can be derived from /api/reports/analytics if needed.'
  });
};

module.exports = { getProfile, updateProfile, getWaiterAnalytics };
