const CustomerHistory = require('../models/CustomerHistory');

const getProfile = async (req, res) => {
  const user = req.user;
  return res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    dateOfJoining: user.dateOfJoining,
    salary: user.salary,
    shiftStart: user.shiftStart,
    shiftEnd: user.shiftEnd
  });
};

const getWaiterAnalytics = async (req, res) => {
  const waiterId = req.user._id;
  const match = { 'waiter.id': waiterId };
  if (req.branchId) match.branchId = req.branchId;
  const agg = await CustomerHistory.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
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
