const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const { listFeedback, createFeedback } = require('../../controllers/support/supportController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('settings:view'), listFeedback);
router.post('/', requirePermission('settings:edit'), [body('message').notEmpty()], validate, createFeedback);

module.exports = router;
