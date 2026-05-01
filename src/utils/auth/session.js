const jwt = require('jsonwebtoken');
const User = require('../../models/users/User');
const UserBranchRole = require('../../models/users/UserBranchRole');
const { initFirebase, admin, isConfigured } = require('../firebase/admin');

const hydrateUserRole = ({ user, memberships = [] }) => {
  if (user) {
    user.isBranchOwner = memberships.some((membership) => membership?.isOwner);
  }
  return user;
};

const resolveUserSession = async (token) => {
  if (!token) {
    return { error: 'Missing token', status: 401 };
  }

  if (isConfigured()) initFirebase();

  if (isConfigured()) {
    try {
      const decodedFirebaseToken = await admin.auth().verifyIdToken(token);
      let user = await User.findOne({ firebaseUid: decodedFirebaseToken.uid }).select('-password');

      if (!user && decodedFirebaseToken.email) {
        user = await User.findOne({ email: decodedFirebaseToken.email.toLowerCase() }).select('-password');
        if (user && !user.firebaseUid) {
          user.firebaseUid = decodedFirebaseToken.uid;
          await user.save();
        }
      }

      if (user) {
        const memberships = await UserBranchRole.find({
          userId: user._id,
          $or: [{ active: true }, { status: 'active' }]
        });
        hydrateUserRole({ user, memberships });
        return { user, memberships, provider: 'firebase' };
      }
    } catch (_) {
      // Fall through to JWT verification.
    }
  }

  if (!process.env.JWT_SECRET) {
    return { error: 'JWT secret missing', status: 500 };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return { error: 'Invalid token', status: 401 };
    }

    const memberships = await UserBranchRole.find({
      userId: user._id,
      $or: [{ active: true }, { status: 'active' }]
    });
    hydrateUserRole({ user, memberships });
    return { user, memberships, provider: 'jwt' };
  } catch (error) {
    return {
      error: `Token verification failed: ${error.message}`,
      status: 401
    };
  }
};

module.exports = {
  hydrateUserRole,
  resolveUserSession
};
