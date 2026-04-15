const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { body, param } = require('express-validator');
const validate = require('../../middleware/validate');
const { listDepartments, createDepartment, updateDepartment, deleteDepartment } = require('../../controllers/users/departmentController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('settings:view'), listDepartments);
router.post(
  '/',
  requirePermission('settings:edit'),
  [body('name').notEmpty()],
  validate,
  createDepartment
);
router.put(
  '/:id',
  requirePermission('settings:edit'),
  [param('id').isMongoId()],
  validate,
  updateDepartment
);
router.delete(
  '/:id',
  requirePermission('settings:edit'),
  [param('id').isMongoId()],
  validate,
  deleteDepartment
);

module.exports = router;
