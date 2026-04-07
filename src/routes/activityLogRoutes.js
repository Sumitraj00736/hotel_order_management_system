const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const { listActivityLogs } = require('../controllers/activityLogController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('settings:view'), listActivityLogs);

module.exports = router;
