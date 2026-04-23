const jwt = require('jsonwebtoken');
const User = require('../models/users/User');
const { initFirebase, admin, isConfigured } = require('../utils/firebase/admin');

/**
 * Hybrid Auth Middleware
 * Supports both Firebase ID Tokens and legacy JWTs.
 * Prioritizes Firebase for modern security.
 */
const auth = async (req, res, next) => {
  // Ensure Firebase is initialized (if configured).
  if (isConfigured()) initFirebase();

  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Missing token' });
    }

    // 1. Try Firebase verification first
    if (isConfigured()) {
      try {
        const decodedFirebaseToken = await admin.auth().verifyIdToken(token);

        let user = await User.findOne({ firebaseUid: decodedFirebaseToken.uid }).select('-password');

        // 1-time link: if firebaseUid not present but email matches, link it.
        if (!user && decodedFirebaseToken.email) {
          user = await User.findOne({ email: decodedFirebaseToken.email.toLowerCase() }).select('-password');
          if (user && !user.firebaseUid) {
            user.firebaseUid = decodedFirebaseToken.uid;
            await user.save();
          }
        }

        if (user) {
          const UserBranchRole = require('../models/users/UserBranchRole');
          // Support both legacy `active` boolean and modern `status` field.
          const memberships = await UserBranchRole.find({
            userId: user._id,
            $or: [{ active: true }, { status: 'active' }]
          });

          if (memberships.some((m) => m.isOwner)) {
            user.role = 'superadmin';
          }

          req.user = user;
          return next();
        }
      } catch (fbError) {
        // Fall through to legacy JWT verification.
      }
    }

    // 2. Legacy JWT verification fallback
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT secret missing');
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ message: 'Invalid token' });
      }

      if (user) {
        const UserBranchRole = require('../models/users/UserBranchRole');
        const memberships = await UserBranchRole.find({
          userId: user._id,
          $or: [{ active: true }, { status: 'active' }]
        });
        if (memberships.some(m => m.isOwner)) {
          user.role = 'superadmin';
        }
        req.user = user;
      }
      return next();
    } catch (jwtError) {
      return res.status(401).json({ 
        message: 'Unauthorized', 
        error: `Token verification failed: ${jwtError.message}`
      });
    }
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized', error: `Global Catch: ${error.message}` });
  }
};

module.exports = auth;
