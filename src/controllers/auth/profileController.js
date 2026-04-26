const SalesInvoice = require('../../models/finance/SalesInvoice');
const Branch = require('../../models/core/Branch');

const getProfile = async (req, res) => {
  const user = req.user;
  let activeBranch = null;

  if (req.branchId) {
    activeBranch = await Branch.findById(req.branchId).select('name code address active').lean();
  }

  return res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
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

module.exports = { getProfile, getWaiterAnalytics };
