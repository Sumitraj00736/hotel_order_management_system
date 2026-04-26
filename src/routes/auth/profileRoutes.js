const express = require('express');
const { body } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { getProfile, updateProfile, getWaiterAnalytics } = require('../../controllers/auth/profileController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/me', getProfile);
router.put(
  '/me',
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
    body('phone').optional().isString().trim().isLength({ min: 7, max: 25 }),
    body('profileImageUrl').optional().isString().trim(),
    body('citizenshipNumber').optional().isString().trim().isLength({ max: 60 }),
    body('citizenshipImageUrl').optional().isString().trim(),
    body('address').optional().isString().trim().isLength({ max: 300 }),
    body('emergencyContactName').optional().isString().trim().isLength({ max: 120 }),
    body('emergencyContactPhone').optional().isString().trim().isLength({ max: 25 })
  ],
  validate,
  updateProfile
);
router.get('/waiter/analytics', requirePermission('orders:view'), getWaiterAnalytics);

module.exports = router;
