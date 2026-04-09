const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const { listSpaces, createSpace, updateSpace, deleteSpace } = require('../controllers/spaceController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('tables:view'), listSpaces);
router.post(
  '/',
  requirePermission('tables:edit'),
  [body('name').notEmpty(), body('capacity').optional().isInt({ min: 0 }), body('charge').optional().isFloat({ min: 0 })],
  validate,
  createSpace
);
router.put(
  '/:id',
  requirePermission('tables:edit'),
  [param('id').isMongoId(), body('capacity').optional().isInt({ min: 0 }), body('charge').optional().isFloat({ min: 0 })],
  validate,
  updateSpace
);
router.delete('/:id', requirePermission('tables:edit'), deleteSpace);

module.exports = router;
