const express = require('express');
const { body } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { getDaybookSummary, closeDaybook, listDaybookHistory } = require('../../controllers/finance/daybookController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/summary', requirePermission('billing:view'), getDaybookSummary);
router.get('/history', requirePermission('billing:view'), listDaybookHistory);
router.post(
  '/close',
  requirePermission('billing:edit'),
  [body('remarks').optional().isString()],
  validate,
  closeDaybook
);

module.exports = router;

