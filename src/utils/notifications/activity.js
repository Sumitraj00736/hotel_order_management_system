const ActivityLog = require('../../models/notifications/ActivityLog');

const buildActivityPayload = ({
  req,
  branchId,
  orgId,
  title,
  type,
  action,
  description,
  performedBy,
  entityType,
  entityId,
  metadata
}) => {
  const payload = {
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
  };

  if (orgId) payload.orgId = orgId;

  return payload;
};

const logActivity = async ({
  req,
  branchId,
  orgId,
  title,
  type,
  action,
  description,
  performedBy,
  entityType,
  entityId,
  metadata
}) => {
  if (!branchId && !orgId) return null;
  return ActivityLog.create(buildActivityPayload({
    req,
    branchId,
    orgId,
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
