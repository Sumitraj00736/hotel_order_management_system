const Branch = require('../../models/core/Branch');
const UserBranchRole = require('../../models/users/UserBranchRole');
const BranchSettings = require('../../models/settings/BranchSettings');
const Organization = require('../../models/core/Organization');
const { resolveRolePermissions } = require('../../utils/auth/permissions');
const { logActivity } = require('../../utils/notifications/activity');

/**
 * Create a new branch for the current organization
 * Only superadmins can call this
 */
const createBranch = async (req, res) => {
  try {
    const { name, address, timezone } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Branch name is required' });
    }

    if (!req.orgId) {
      return res.status(400).json({ message: 'Organization context missing' });
    }

    // 1. Generate unique code
    const baseCode = (name || 'branch').toLowerCase().replace(/\s+/g, '-');
    let code = `${baseCode}-${Date.now().toString(36)}`;

    // 2. Create Branch
    const branch = await Branch.create({
      name,
      address,
      timezone: timezone || 'UTC',
      orgId: req.orgId,
      code
    });

    // 3. Link current user to this branch as superadmin
    await UserBranchRole.create({
      userId: req.user._id,
      branchId: branch._id,
      orgId: req.orgId,
      role: 'superadmin',
      permissions: resolveRolePermissions({ roleName: 'superadmin' }),
      isOwner: true,
      status: 'active',
      active: true
    });

    // 4. Initialize Branch Settings
    const org = await Organization.findById(req.orgId).lean();
    await BranchSettings.create({
      branchId: branch._id,
      restaurant: {
        name: org?.name || name,
        address: address || '',
        currency: 'NPR', // Default
        priceField: 'NPR'
      },
      tax: {
        priceRelation: 'inclusive'
      },
      notifications: {
        newOrderSound: 'default'
      }
    });

    // 5. Log activity
    await logActivity({
      branchId: branch._id,
      title: 'New Branch Created',
      type: 'Branch Created',
      description: `${req.user.name} created a new branch: ${name}`,
      performedBy: req.user._id
    });

    return res.status(201).json({
      message: 'Branch created successfully',
      branch: {
        id: branch._id,
        name: branch.name,
        code: branch.code,
        address: branch.address
      }
    });

  } catch (error) {
    console.error('Branch creation failed:', error);
    return res.status(500).json({ message: 'Failed to create branch', error: error.message });
  }
};

/**
 * List all branches for the current organization
 */
const listBranches = async (req, res) => {
  try {
    if (!req.orgId) {
      return res.status(400).json({ message: 'Organization context missing' });
    }

    const branches = await Branch.find({ orgId: req.orgId })
      .populate('orgId', 'name')
      .select('name code address active settings orgId');

    const mapped = branches.map(b => ({
      _id: b._id,
      branchId: b._id,
      name: b.name,
      branchName: b.name,
      code: b.code,
      address: b.address,
      active: b.active,
      orgName: b.orgId?.name
    }));

    return res.json(mapped);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list branches', error: error.message });
  }
};

module.exports = {
  createBranch,
  listBranches
};
