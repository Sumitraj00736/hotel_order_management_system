const express = require('express');
const { body, query } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const validate = require('../../middleware/validate');
const {
  subscribe,
  unsubscribe,
  toggle,
  status,
  getPublicKeyController,
  getFirebaseConfig,
  testPush
} = require('../../controllers/notifications/pushController');

const router = express.Router();

router.get('/public-key', auth, getPublicKeyController);
router.get('/config', getFirebaseConfig);
router.get('/status', auth, [query('deviceId').notEmpty()], validate, status);
router.post(
  '/subscribe',
  auth,
  branchScope,
  [body('fcmToken').notEmpty(), body('deviceId').notEmpty(), body('enabled').optional().isBoolean(), body('platform').optional().isString()],
  validate,
  subscribe
);
router.post(
  '/unsubscribe',
  auth,
  branchScope,
  [body().custom((value) => {
    if (value?.deviceId || value?.fcmToken) return true;
    throw new Error('deviceId or fcmToken required');
  })],
  validate,
  unsubscribe
);
router.patch('/toggle', auth, branchScope, [body('deviceId').notEmpty(), body('enabled').isBoolean()], validate, toggle);
router.post('/test', auth, branchScope, [body('title').optional().isString(), body('body').optional().isString()], validate, testPush);

module.exports = router;
