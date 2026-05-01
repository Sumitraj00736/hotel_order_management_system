const crypto = require('crypto');
const IdempotencyRequest = require('../../models/core/IdempotencyRequest');

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

const sortValue = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortValue(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const buildFingerprint = (body) =>
  crypto.createHash('sha256').update(JSON.stringify(sortValue(body || {}))).digest('hex');

const getIdempotencyContext = (req, scope) => {
  const key = String(req.header(IDEMPOTENCY_HEADER) || '').trim();
  if (!key) return null;

  return {
    key,
    scope,
    method: req.method,
    path: req.route?.path || req.originalUrl,
    branchId: req.branchId || null,
    userId: req.user?._id || null,
    fingerprint: buildFingerprint(req.body)
  };
};

const beginIdempotentRequest = async (context, session) => {
  if (!context) {
    return { mode: 'disabled' };
  }

  const existing = await IdempotencyRequest.findOne({
    key: context.key,
    scope: context.scope,
    method: context.method,
    path: context.path,
    branchId: context.branchId,
    userId: context.userId
  }).session(session);

  if (existing) {
    if (existing.fingerprint !== context.fingerprint) {
      return { mode: 'conflict', status: 409, body: { message: 'Idempotency key reuse with different payload is not allowed.' } };
    }
    if (existing.status === 'completed') {
      return {
        mode: 'replay',
        status: existing.responseStatus || 200,
        body: existing.responseBody || {}
      };
    }
    return { mode: 'conflict', status: 409, body: { message: 'A request with this idempotency key is already in progress.' } };
  }

  const [record] = await IdempotencyRequest.create(
    [{
      key: context.key,
      scope: context.scope,
      method: context.method,
      path: context.path,
      branchId: context.branchId,
      userId: context.userId,
      fingerprint: context.fingerprint,
      status: 'pending'
    }],
    { session }
  );

  return { mode: 'created', record };
};

const completeIdempotentRequest = async ({ recordId, status, body, resourceType, resourceId, session }) => {
  if (!recordId) return;
  await IdempotencyRequest.findByIdAndUpdate(
    recordId,
    {
      $set: {
        status: 'completed',
        responseStatus: status,
        responseBody: body,
        resourceType: resourceType || undefined,
        resourceId: resourceId || undefined,
        completedAt: new Date()
      }
    },
    { session }
  );
};

module.exports = {
  IDEMPOTENCY_HEADER,
  buildFingerprint,
  getIdempotencyContext,
  beginIdempotentRequest,
  completeIdempotentRequest
};
