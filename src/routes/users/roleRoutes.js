const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const { listRoles, createRole, updateRole, deleteRole } = require('../../controllers/users/roleController');

const router = express.Router();

router.use(auth, branchScope);
router.use((req, res, next) => {
  const role = (req.branchRole || req.user?.role || '').toLowerCase();
  if (role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return next();
});

router.get('/', requirePermission('roles:manage'), listRoles);
router.post('/', requirePermission('roles:manage'), createRole);
router.put('/:id', requirePermission('roles:manage'), updateRole);
router.delete('/:id', requirePermission('roles:manage'), deleteRole);

module.exports = router;
