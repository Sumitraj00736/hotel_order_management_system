const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { limitCustomers } = require('../../middleware/checkPlanLimit');
const {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getRewardsSettings,
  updateRewardsSettings
} = require('../../controllers/customers/customerController');

const router = express.Router();
router.use(auth, branchScope);

router.get('/', requirePermission('customers:view'), listCustomers);
router.post(
  '/',
  requirePermission('customers:edit'),
  limitCustomers,
  [body('name').notEmpty().withMessage('Customer name is required')],
  validate,
  createCustomer
);
router.put(
  '/:id',
  requirePermission('customers:edit'),
  [param('id').isMongoId()],
  validate,
  updateCustomer
);
router.delete(
  '/:id',
  requirePermission('customers:edit'),
  [param('id').isMongoId()],
  validate,
  deleteCustomer
);
router.get('/rewards', requirePermission('customers:view'), getRewardsSettings);
router.put('/rewards', requirePermission('customers:edit'), updateRewardsSettings);

module.exports = router;
