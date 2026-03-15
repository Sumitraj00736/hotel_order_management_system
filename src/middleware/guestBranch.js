// Minimal branch resolver for guest endpoints: requires x-branch-id
const guestBranch = (req, res, next) => {
  const branchId = req.header('x-branch-id');
  if (!branchId) {
    return res.status(400).json({ message: 'Branch required', code: 'BRANCH_REQUIRED' });
  }
  req.branchId = branchId;
  return next();
};

module.exports = guestBranch;
