const { resolveUserSession } = require('../utils/auth/session');
const createError = require('http-errors');

// Optional logger – fall back to console if custom logger is not present
let logger;
try {
  // Adjust the path if your logger lives elsewhere
  logger = require('../utils/logger');
} catch (e) {
  logger = console;
}

/**
 * Auth middleware – validates Bearer token (Firebase ID token or legacy JWT).
 * On success it populates `req.user`, `req.authProvider` and `req.userMemberships`.
 * Errors are forwarded to Express' error‑handling stack via http-errors.
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    // ---------------------------------------------------------------------
    // 1️⃣  Missing token – short‑circuit and report 401 immediately
    // ---------------------------------------------------------------------
    if (!token) {
      return next(createError(401, 'Missing Authorization token'));
    }

    // ---------------------------------------------------------------------
    // 2️⃣  Resolve session (Firebase or legacy JWT) – unified shape
    // ---------------------------------------------------------------------
    const session = await resolveUserSession(token);

    // ---------------------------------------------------------------------
    // 3️⃣  Normalised failure handling – log internally, hide details from client
    // ---------------------------------------------------------------------
    if (session.error) {
      logger.warn('Authentication failure', {
        ip: req.ip,
        provider: session.provider,
        status: session.status || 401,
        error: session.error,
      });
      // Forward a generic Unauthorized error to central error handler
      return next(createError(session.status || 401, 'Unauthorized'));
    }

    // ---------------------------------------------------------------------
    // 4️⃣  Success – attach useful fields to request object
    // ---------------------------------------------------------------------
    req.user = session.user;
    req.authProvider = session.provider;
    req.userMemberships = session.memberships || [];
    return next();
  } catch (err) {
    // ---------------------------------------------------------------------
    // 5️⃣  Unexpected runtime error – log and respond with generic 401
    // ---------------------------------------------------------------------
    logger.error('Unexpected error in auth middleware', { ip: req.ip, err });
    return next(createError(401, 'Unauthorized'));
  }
};

module.exports = auth;
