const ActivityLog = require('../../models/notifications/ActivityLog');

const listActivityLogs = async (req, res) => {
  const { type, dateFrom, dateTo, search, page = 1, limit = 50 } = req.query;
  const filter = { branchId: req.branchId };
  if (type) filter.type = type;
  if (dateFrom || dateTo) {
    filter.createdAt = {};
    if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
    if (dateTo) filter.createdAt.$lte = new Date(dateTo);
  }
  if (search) {
    filter.$or = [
      { title: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') }
    ];
  }

  const numericPage = Math.max(Number(page) || 1, 1);
  const numericLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const [items, total] = await Promise.all([
    ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .populate('performedBy', 'name email'),
    ActivityLog.countDocuments(filter)
  ]);

  return res.json({ data: items, total, page: numericPage, limit: numericLimit });
};

module.exports = { listActivityLogs };
