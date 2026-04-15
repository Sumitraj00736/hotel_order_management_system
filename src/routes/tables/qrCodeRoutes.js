const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { listQrCodes } = require('../../controllers/tables/qrCodeController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('tables:view'), listQrCodes);

module.exports = router;
