const jwt = require('jsonwebtoken');
const PlatformAdmin = require('../models/honor/PlatformAdmin');

const platformAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.substring(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ensure this token was issued for a platform admin
    if (decoded.type !== 'platform_admin') {
      return res.status(403).json({ message: 'Forbidden: Platform Admin access only' });
    }

    const admin = await PlatformAdmin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'Unauthorized: Admin record not found' });
    }

    req.platformAdmin = admin;
    req.user = admin; // For compatibility with controllers that expect req.user
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized', error: error.message });
  }
};

module.exports = platformAuth;
