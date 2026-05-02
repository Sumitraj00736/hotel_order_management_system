const express = require('express');
const platformAuth = require('../../middleware/platformAuth');
const { 
  getPlatformStats, 
  listRestaurants, 
  getRestaurantDetail, 
  getBranchUsers,
  updateBranchSubscription,
  archiveRestaurant,
  restoreRestaurant,
  getRestaurantAudit
} = require('../../controllers/platform/adminController');

const router = express.Router();

router.use(platformAuth);

router.get('/stats', getPlatformStats);
router.get('/restaurants', listRestaurants);
router.get('/restaurants/:id', getRestaurantDetail);
router.get('/restaurants/:id/audit', getRestaurantAudit);
router.post('/restaurants/:id/archive', archiveRestaurant);
router.post('/restaurants/:id/restore', restoreRestaurant);
router.get('/branches/:branchId/users', getBranchUsers);
router.patch('/branches/:branchId/subscription', updateBranchSubscription);

module.exports = router;
