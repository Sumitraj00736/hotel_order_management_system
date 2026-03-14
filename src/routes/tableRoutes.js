const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listTables, getTable, createTable, updateTable, deleteTable, freeTable } = require('../controllers/tableController');

const router = express.Router();

router.use(auth);

router.get('/', listTables);
router.get('/:id', getTable);

router.post(
  '/',
  requireRole('admin'),
  [body('tableNumber').isInt({ min: 1 }), body('row').optional().isInt({ min: 1 }), body('column').optional().isInt({ min: 1 })],
  validate,
  createTable
);
router.put(
  '/:id',
  requireRole('admin'),
  [
    body('status').optional().isIn(['available', 'occupied']),
    body('row').optional().isInt({ min: 1 }),
    body('column').optional().isInt({ min: 1 })
  ],
  validate,
  updateTable
);
router.delete('/:id', requireRole('admin'), deleteTable);
router.patch('/:id/free', requireRole('admin', 'waiter'), freeTable);

module.exports = router;
