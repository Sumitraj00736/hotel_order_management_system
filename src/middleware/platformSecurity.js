const rateLimit = require('express-rate-limit');
const PlatformAuditLog = require('../models/platform/PlatformAuditLog');

// Rate limiter for Platform KPI dashboard (60 req/min)
const kpiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: 'Too many requests to KPI dashboard. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for mutating Plan endpoints (30 req/min)
const planMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: 'Too many plan modifications. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter for CSV exports (5 req/hour)
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { message: 'Export limit reached. Maximum 5 exports per hour allowed.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware to log audit trails for platform admin actions
const auditLogger = (action, entityType) => async (req, res, next) => {
  // Save original send to capture response
  const originalSend = res.json;

  res.json = function (body) {
    res.json = originalSend;
    
    // Only log if successful (status 2xx)
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      // Determine entityId from params or response body
      let entityId = req.params?.id || body?.plan?.id || body?.restaurant?.id || null;
      if (!entityId && body?.data?.id) entityId = body.data.id;

      // Ensure entityId is captured for POST requests from response
      if (!entityId && req.method === 'POST' && body?._id) entityId = body._id;

      const logEntry = {
        admin_user_id: req.user._id,
        action,
        entity_type: entityType,
        entity_id: entityId || req.user._id, // Fallback if no specific entity
        ip_address: req.ip || req.connection?.remoteAddress,
        user_agent: req.headers['user-agent'],
        new_value: req.body // Record what they sent
      };

      PlatformAuditLog.create(logEntry).catch((err) => {
        console.error('[AuditLogger] Failed to write audit log:', err.message);
      });
    }

    return res.json(body);
  };

  next();
};

module.exports = {
  kpiRateLimiter,
  planMutationLimiter,
  exportLimiter,
  auditLogger
};
