const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { listNotifications, markRead, markAllRead } = require('../../controllers/notifications/notificationController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('notifications:view'), listNotifications);
router.patch('/:id/read', requirePermission('notifications:edit'), markRead);
router.patch('/read/all', requirePermission('notifications:edit'), markAllRead);

module.exports = router;
