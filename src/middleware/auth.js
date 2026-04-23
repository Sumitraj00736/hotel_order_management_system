const jwt = require('jsonwebtoken');
const User = require('../models/users/User');
const admin = require('../utils/firebase/admin');

/**
 * Hybrid Auth Middleware
 * Supports both Firebase ID Tokens and legacy JWTs.
 * Prioritizes Firebase for modern security.
 */
const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Missing token' });
    }

    // 1. Try Firebase verification first
    try {
      const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
      let user = await User.findOne({ firebaseUid: decodedFirebaseToken.uid }).select('-password');
      
      // If user exists but unlinked, try finding by email
      if (!user && decodedFirebaseToken.email) {
        user = await User.findOne({ email: decodedFirebaseToken.email }).select('-password');
        if (user) {
          user.firebaseUid = decodedFirebaseToken.uid;
          await user.save();
        }
      }

      if (user) {
        req.user = user;
        return next();
      }
    } catch (fbError) {
      // Not a valid Firebase token, or user not found, fall back to JWT
      // console.log('Firebase verification failed, falling back to legacy JWT');
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

      req.user = user;
      return next();
    } catch (jwtError) {
      return res.status(401).json({ message: 'Unauthorized', error: 'Invalid authentication token' });
    }
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized', error: error.message });
  }
};

module.exports = auth;
