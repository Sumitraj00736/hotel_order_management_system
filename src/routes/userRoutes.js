const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const { listUsers, getUser, createUser, updateUser, deleteUser, updateUserStatus, updateUserRole } = require('../controllers/userController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/', requirePermission('staff:view'), listUsers);
router.get('/:id', requirePermission('staff:view'), getUser);
router.post(
  '/',
  requirePermission('staff:edit'),
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('phone').optional().isString(),
    body('password').isLength({ min: 6 }),
    body('role').optional().isString(),
    body('roleId').optional().isMongoId(),
    body('dateOfJoining').optional().isISO8601(),
    body('salary').optional().isFloat({ min: 0 }),
    body('shiftStart').optional().isString(),
    body('shiftEnd').optional().isString()
  ],
  validate,
  createUser
);
router.put(
  '/:id',
  requirePermission('staff:edit'),
  [
    body('email').optional().isEmail(),
    body('phone').optional().isString(),
    body('password').optional().isLength({ min: 6 }),
    body('role').optional().isString(),
    body('roleId').optional().isMongoId(),
    body('dateOfJoining').optional().isISO8601(),
    body('salary').optional().isFloat({ min: 0 }),
    body('shiftStart').optional().isString(),
    body('shiftEnd').optional().isString()
  ],
  validate,
  updateUser
);
router.patch('/:id/status', requirePermission('staff:edit'), updateUserStatus);
router.patch('/:id/role', requirePermission('staff:edit'), updateUserRole);
router.delete('/:id', requirePermission('staff:edit'), deleteUser);

module.exports = router;
