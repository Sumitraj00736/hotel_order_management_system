const { initFirebase, admin, isConfigured } = require('../utils/firebase/admin');
const User = require('../models/users/User');

const firebaseAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Missing authentication token' });
    }

    if (!isConfigured()) {
      return res.status(500).json({ message: 'Authentication service not configured' });
    }

    const app = initFirebase();
    const decodedToken = await admin.auth(app).verifyIdToken(token);
    
    // Look up user by firebaseUid
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    // If not found by UID, try by email as 1-time sync
    if (!user && decodedToken.email) {
      user = await User.findOne({ email: decodedToken.email.toLowerCase() });
      if (user) {
        // Link existing user to firebaseUid
        user.firebaseUid = decodedToken.uid;
        await user.save();
      }
    }

    if (!user) {
      // In a high-level architecture, we might allow auto-registration or 
      // return a specific code for the frontend to handle "Unlinked Account"
      return res.status(401).json({ 
        message: 'No associated staff account found', 
        code: 'USER_NOT_LINKED',
        firebaseUid: decodedToken.uid,
        email: decodedToken.email
      });
    }

    req.user = user;
    req.firebaseUser = decodedToken;
    return next();
  } catch (error) {
    return res.status(401).json({ 
      message: 'Unauthorized', 
      error: error.message,
      code: error.code === 'auth/id-token-expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
  }
};

module.exports = firebaseAuth;
