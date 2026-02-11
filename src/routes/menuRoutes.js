const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listMenu, getMenuItem, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');

const router = express.Router();

router.use(auth);

router.get('/', listMenu);
router.get('/:id', getMenuItem);

router.post(
  '/',
  requireRole('admin'),
  [body('name').notEmpty(), body('category').notEmpty(), body('price').isFloat({ min: 0 })],
  validate,
  createMenuItem
);
router.put(
  '/:id',
  requireRole('admin'),
  [
    body('name').optional().notEmpty(),
    body('category').optional().notEmpty(),
    body('price').optional().isFloat({ min: 0 })
  ],
  validate,
  updateMenuItem
);
router.delete('/:id', requireRole('admin'), deleteMenuItem);

module.exports = router;
