const express = require('express');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const { createBranch, listBranches } = require('../../controllers/core/branchController');

const router = express.Router();

// All branch routes require authentication and branch context (to get orgId)
router.use(auth, branchScope);

// Only superadmins can create branches
router.use((req, res, next) => {
  const role = (req.branchRole || req.user?.role || '').toLowerCase();
  if (role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden: Superadmin access required' });
  }
  return next();
});

router.post('/', createBranch);
router.get('/', listBranches);

module.exports = router;
