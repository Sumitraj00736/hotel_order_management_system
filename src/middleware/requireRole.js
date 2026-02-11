const requireRole = (...allowed) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (allowed.includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({ message: 'Forbidden' });
};

module.exports = requireRole;
