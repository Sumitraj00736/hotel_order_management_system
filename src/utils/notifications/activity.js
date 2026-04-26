const ActivityLog = require('../../models/notifications/ActivityLog');

const buildActivityPayload = ({
  req,
  branchId,
  title,
  type,
  action,
  description,
  performedBy,
  entityType,
  entityId,
  metadata
}) => ({
  branchId,
  title,
  type,
  action,
  description,
  performedBy,
  requestId: req?.requestId,
  entityType,
  entityId: entityId ? String(entityId) : undefined,
  ipAddress: req?.ip,
  userAgent: req?.headers?.['user-agent'],
  metadata
});

const logActivity = async ({
  req,
  branchId,
  title,
  type,
  action,
  description,
  performedBy,
  entityType,
  entityId,
  metadata
}) => {
  if (!branchId) return null;
  return ActivityLog.create(buildActivityPayload({
    req,
    branchId,
    title,
    type,
    action,
    description,
    performedBy,
    entityType,
    entityId,
    metadata
  }));
};

module.exports = { logActivity, buildActivityPayload };
