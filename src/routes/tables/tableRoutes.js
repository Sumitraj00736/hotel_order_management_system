const express = require('express');
const { body } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { listTables, getTable, createTable, updateTable, deleteTable, freeTable } = require('../../controllers/tables/tableController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('tables:view'), listTables);
router.get('/:id', requirePermission('tables:view'), getTable);

router.post(
  '/',
  requirePermission('tables:edit'),
  [
    body('tableNumber').isInt({ min: 1 }),
    body('name').optional().isString(),
    body('type').optional().isString(),
    body('spaceId').optional().isMongoId(),
    body('tableTypeId').optional().isMongoId(),
    body('capacity').optional().isInt({ min: 0 }),
    body('charge').optional().isFloat({ min: 0 }),
    body('row').optional().isInt({ min: 1 }),
    body('column').optional().isInt({ min: 1 })
  ],
  validate,
  createTable
);
router.put(
  '/:id',
  requirePermission('tables:edit'),
  [
    body('status').optional().isIn(['available', 'occupied']),
    body('name').optional().isString(),
    body('type').optional().isString(),
    body('spaceId').optional().isMongoId(),
    body('tableTypeId').optional().isMongoId(),
    body('capacity').optional().isInt({ min: 0 }),
    body('charge').optional().isFloat({ min: 0 }),
    body('row').optional().isInt({ min: 1 }),
    body('column').optional().isInt({ min: 1 }),
    body('isTrashed').optional().isBoolean()
  ],
  validate,
  updateTable
);
router.delete('/:id', requirePermission('tables:edit'), deleteTable);
router.patch('/:id/free', requirePermission('tables:edit'), freeTable);

module.exports = router;
