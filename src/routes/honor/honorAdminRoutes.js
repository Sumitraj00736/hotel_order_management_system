const express = require('express');
const auth = require('../../middleware/auth');
const { 
  getPlatformStats, 
  listRestaurants, 
  getRestaurantDetail, 
  getBranchUsers 
} = require('../../controllers/honor/honorAdminController');

const router = express.Router();

// Middleware to ensure the user is a platform-level superadmin
// In a real app, you might have a flag like user.isPlatformAdmin
// For now, we'll check if the role is 'superadmin' and they don't have a specific branch scope restricting them
const platformAdminOnly = (req, res, next) => {
  if (req.user?.role?.toLowerCase() !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden: Platform Admin access required' });
  }
  next();
};

router.use(auth, platformAdminOnly);

router.get('/stats', getPlatformStats);
router.get('/restaurants', listRestaurants);
router.get('/restaurants/:id', getRestaurantDetail);
router.get('/branches/:branchId/users', getBranchUsers);

module.exports = router;
