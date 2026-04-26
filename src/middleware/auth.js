const { resolveUserSession } = require('../utils/auth/session');

/**
 * Hybrid Auth Middleware
 * Supports both Firebase ID Tokens and legacy JWTs.
 * Prioritizes Firebase for modern security.
 */
const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;
    const session = await resolveUserSession(token);
    if (session.error) {
      return res.status(session.status || 401).json({
        message: session.status === 401 ? 'Unauthorized' : 'Authentication failed',
        error: session.error
      });
    }

    req.user = session.user;
    req.authProvider = session.provider;
    req.userMemberships = session.memberships || [];
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized', error: `Global Catch: ${error.message}` });
  }
};

module.exports = auth;
