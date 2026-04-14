const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const {
  getRestaurantDetails,
  updateRestaurantDetails,
  getTaxSettings,
  updateTaxSettings,
  getNotificationSettings,
  updateNotificationSettings,
  getInvoiceSettings,
  updateInvoiceSettings,
  getKotSettings,
  updateKotSettings,
  getPrinterSettings,
  updatePrinterSettings
} = require('../controllers/settingsController');

const router = express.Router();

router.use(auth, branchScope);
router.use((req, res, next) => {
  const role = (req.branchRole || req.user?.role || '').toLowerCase();
  if (role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return next();
});

router.get('/restaurant-details', requirePermission('settings:view'), getRestaurantDetails);
router.put('/restaurant-details', requirePermission('settings:edit'), updateRestaurantDetails);

router.get('/tax-rates', requirePermission('settings:view'), getTaxSettings);
router.put('/tax-rates', requirePermission('settings:edit'), updateTaxSettings);

router.get('/notifications', requirePermission('settings:view'), getNotificationSettings);
router.put('/notifications', requirePermission('settings:edit'), updateNotificationSettings);

router.get('/invoice', requirePermission('settings:view'), getInvoiceSettings);
router.put('/invoice', requirePermission('settings:edit'), updateInvoiceSettings);

router.get('/kot', requirePermission('settings:view'), getKotSettings);
router.put('/kot', requirePermission('settings:edit'), updateKotSettings);

router.get('/printer', requirePermission('settings:view'), getPrinterSettings);
router.put('/printer', requirePermission('settings:edit'), updatePrinterSettings);

module.exports = router;
