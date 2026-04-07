const ActivityLog = require('../models/ActivityLog');

const logActivity = async ({
  branchId,
  title,
  type,
  description,
  performedBy
}) => {
  if (!branchId) return null;
  return ActivityLog.create({
    branchId,
    title,
    type,
    description,
    performedBy
  });
};

module.exports = { logActivity };
