const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listUsers, getUser, createUser, updateUser, deleteUser } = require('../controllers/userController');

const router = express.Router();

router.use(auth, requireRole('admin'));

router.get('/', listUsers);
router.get('/:id', getUser);
router.post(
  '/',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
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
router.delete('/:id', deleteUser);

module.exports = router;
