const safeSerializeError = (error) => {
  if (!error) return undefined;
  return {
    message: error.message,
    name: error.name,
    stack: error.stack
  };
};

const emitLog = ({ level, message, ...context }) => {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...context
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
};

const createRequestLogger = (req) => ({
  info(message, context = {}) {
    emitLog({
      level: 'info',
      message,
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      branchId: req.branchId || undefined,
      userId: req.user?._id?.toString?.() || req.user?.id,
      ...context
    });
  },
  warn(message, context = {}) {
    emitLog({
      level: 'warn',
      message,
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      branchId: req.branchId || undefined,
      userId: req.user?._id?.toString?.() || req.user?.id,
      ...context
    });
  },
  error(message, context = {}) {
    emitLog({
      level: 'error',
      message,
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      branchId: req.branchId || undefined,
      userId: req.user?._id?.toString?.() || req.user?.id,
      ...context,
      error: safeSerializeError(context.error)
    });
  }
});

module.exports = {
  emitLog,
  createRequestLogger,
  safeSerializeError
};
