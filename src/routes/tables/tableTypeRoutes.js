const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const {
  listTableTypes,
  createTableType,
  updateTableType,
  deleteTableType
} = require('../../controllers/tables/tableTypeController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('tables:view'), listTableTypes);
router.post(
  '/',
  requirePermission('tables:edit'),
  [body('name').notEmpty().isString(), body('active').optional().isBoolean()],
  validate,
  createTableType
);
router.put(
  '/:id',
  requirePermission('tables:edit'),
  [param('id').isMongoId(), body('name').optional().isString(), body('active').optional().isBoolean()],
  validate,
  updateTableType
);
router.delete('/:id', requirePermission('tables:edit'), [param('id').isMongoId()], validate, deleteTableType);

module.exports = router;

