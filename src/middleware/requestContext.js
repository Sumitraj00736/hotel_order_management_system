const crypto = require('crypto');
const { createRequestLogger } = require('../utils/observability/logger');

const requestContext = (req, res, next) => {
  const incomingRequestId = req.header('x-request-id');
  req.requestId =
    incomingRequestId && String(incomingRequestId).trim()
      ? String(incomingRequestId).trim()
      : crypto.randomUUID();
  req.startedAt = Date.now();
  req.log = createRequestLogger(req);

  res.setHeader('x-request-id', req.requestId);
  next();
};

module.exports = requestContext;
