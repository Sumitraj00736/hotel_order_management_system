const express = require('express');
const platformAuth = require('../../middleware/platformAuth');
const {
  getPlatformStats,
  listRestaurants,
  exportRestaurantsCSV,
  getRestaurantDetail,
  getRestaurantAudit,
  archiveRestaurant,
  restoreRestaurant,
  getBranchUsers,
  updateBranchSubscription
} = require('../../controllers/platform/adminController');

const {
  listPlans,
  createPlan,
  getPlan,
  updatePlan,
  deletePlan
} = require('../../controllers/platform/planController');
const { kpiRateLimiter, planMutationLimiter, exportLimiter, auditLogger } = require('../../middleware/platformSecurity');

const router = express.Router();

router.use(platformAuth);

// KPI Stats
router.get('/dashboard/kpi-stats', kpiRateLimiter, getPlatformStats);

// Restaurant Management
router.get('/restaurants', listRestaurants);
router.get('/restaurants/export', exportLimiter, auditLogger('export_restaurants', 'organization'), exportRestaurantsCSV);
router.get('/restaurants/:id', getRestaurantDetail);

router.get('/restaurants/:id/audit', getRestaurantAudit);
router.post('/restaurants/:id/archive', auditLogger('archive_restaurant', 'organization'), archiveRestaurant);
router.post('/restaurants/:id/restore', auditLogger('restore_restaurant', 'organization'), restoreRestaurant);
router.get('/branches/:branchId/users', getBranchUsers);
router.patch('/branches/:branchId/subscription', auditLogger('update_subscription', 'subscription'), updateBranchSubscription);

// Plan Management
router.get('/plans', listPlans);
router.get('/plans/:id', getPlan);
router.post('/plans', planMutationLimiter, auditLogger('create_plan', 'plan'), createPlan);
router.patch('/plans/:id', planMutationLimiter, auditLogger('update_plan', 'plan'), updatePlan);
router.delete('/plans/:id', planMutationLimiter, auditLogger('delete_plan', 'plan'), deletePlan);

module.exports = router;
