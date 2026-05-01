const express = require('express');
const auth = require('../../middleware/auth');
const { isPlatformAdminUser } = require('../../utils/auth/platformAdmin');
const { 
  getPlatformStats, 
  listRestaurants, 
  getRestaurantDetail, 
  getBranchUsers 
} = require('../../controllers/honor/honorAdminController');

const router = express.Router();

const platformAdminOnly = (req, res, next) => {
  if (!isPlatformAdminUser(req.user)) {
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
