const express = require('express');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const { listNotifications, markRead, markAllRead } = require('../controllers/notificationController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', listNotifications);
router.patch('/:id/read', markRead);
router.patch('/read/all', markAllRead);

module.exports = router;
