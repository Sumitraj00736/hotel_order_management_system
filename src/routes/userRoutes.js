const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listUsers, getUser, createUser, updateUser, deleteUser, updateUserStatus } = require('../controllers/userController');

const router = express.Router();

router.use(auth, branchScope, requireRole('admin'));

router.get('/', listUsers);
router.get('/:id', getUser);
router.post(
  '/',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('phone').optional().isString(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['admin', 'waiter', 'kitchen']),
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
  [
    body('email').optional().isEmail(),
    body('phone').optional().isString(),
    body('password').optional().isLength({ min: 6 }),
    body('role').optional().isIn(['admin', 'waiter', 'kitchen']),
    body('dateOfJoining').optional().isISO8601(),
    body('salary').optional().isFloat({ min: 0 }),
    body('shiftStart').optional().isString(),
    body('shiftEnd').optional().isString()
  ],
  validate,
  updateUser
);
router.patch('/:id/status', updateUserStatus);
router.delete('/:id', deleteUser);

module.exports = router;
