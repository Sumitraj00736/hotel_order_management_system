const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const { subscribe, unsubscribe, toggle, status, getPublicKeyController, testPush } = require('../controllers/pushController');

const router = express.Router();

router.get('/public-key', auth, getPublicKeyController);
router.get('/status', auth, status);
router.post('/subscribe', auth, branchScope, subscribe);
router.post('/unsubscribe', auth, unsubscribe);
router.patch('/toggle', auth, toggle);
router.post('/test', auth, testPush);

module.exports = router;
