const express = require('express');
const { login, getMe } = require('../../controllers/platform/platformAuthController');
const platformAuth = require('../../middleware/platformAuth');

const router = express.Router();

router.post('/login', login);
router.get('/me', platformAuth, getMe);

module.exports = router;
