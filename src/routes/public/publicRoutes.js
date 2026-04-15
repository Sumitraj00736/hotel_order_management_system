const express = require('express');
const { getCafeBySlug, getWebsiteSettings, saveWebsiteSettings } = require('../../controllers/public/publicController');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');

const router = express.Router();

// Public (no auth)
router.get('/cafes/:slug', getCafeBySlug);

// Authenticated – website settings CRUD
router.get('/website-settings', auth, branchScope, requirePermission('website:view'), getWebsiteSettings);
router.put('/website-settings', auth, branchScope, requirePermission('website:edit'), saveWebsiteSettings);

module.exports = router;
