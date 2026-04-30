const Organization = require('../../models/core/Organization');
const Branch = require('../../models/core/Branch');
const User = require('../../models/users/User');
const UserBranchRole = require('../../models/users/UserBranchRole');

/**
 * Get overall platform stats
 */
const getPlatformStats = async (req, res) => {
  try {
    const totalRestaurants = await Organization.countDocuments();
    const totalBranches = await Branch.countDocuments();
    const totalUsers = await User.countDocuments();
    
    // Mock subscription data since it's not fully in schema yet
    const activeSubscriptions = {
      basic: Math.floor(totalRestaurants * 0.5),
      pro: Math.floor(totalRestaurants * 0.3),
      enterprise: Math.floor(totalRestaurants * 0.2)
    };

    return res.json({
      totalRestaurants,
      totalBranches,
      totalUsers,
      activeSubscriptions
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch platform stats', error: error.message });
  }
};

/**
 * List all restaurants with their details
 */
const listRestaurants = async (req, res) => {
  try {
    const organizations = await Organization.find().lean();
    
    const restaurantList = await Promise.all(organizations.map(async (org) => {
      const branchesCount = await Branch.countDocuments({ orgId: org._id });
      const usersCount = await UserBranchRole.countDocuments({ orgId: org._id });
      
      // Get owner details (isOwner: true or first superadmin found for this org)
      const ownerRole = await UserBranchRole.findOne({ 
        orgId: org._id, 
        $or: [{ isOwner: true }, { role: 'superadmin' }] 
      })
        .populate('userId', 'name email phone')
        .lean();

      return {
        id: org._id,
        name: org.name,
        owner: ownerRole?.userId?.name || 'Unknown',
        ownerEmail: ownerRole?.userId?.email,
        subscriptionPlan: org.subscription?.plan || 'Basic',
        branchesCount,
        usersCount,
        status: org.active ? 'Active' : 'Suspended',
        registeredDate: org.createdAt
      };
    }));

    return res.json(restaurantList);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list restaurants', error: error.message });
  }
};

/**
 * Get detailed info for a single restaurant
 */
const getRestaurantDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await Organization.findById(id).lean();
    if (!org) return res.status(404).json({ message: 'Restaurant not found' });

    const ownerRole = await UserBranchRole.findOne({ 
      orgId: org._id, 
      $or: [{ isOwner: true }, { role: 'superadmin' }] 
    })
      .populate('userId', 'name email phone profileImageUrl')
      .lean();

    const branches = await Branch.find({ orgId: org._id }).lean();
    const branchDetails = await Promise.all(branches.map(async (branch) => {
      const usersCount = await UserBranchRole.countDocuments({ branchId: branch._id });
      const managerRole = await UserBranchRole.findOne({ branchId: branch._id, role: 'admin' })
        .populate('userId', 'name')
        .lean();

      return {
        id: branch._id,
        name: branch.name,
        location: branch.address || 'Unknown',
        manager: managerRole?.userId?.name || 'N/A',
        usersCount,
        status: branch.active ? 'Active' : 'Inactive'
      };
    }));

    return res.json({
      restaurant: {
        id: org._id,
        name: org.name,
        logo: org.logoUrl,
        owner: ownerRole?.userId?.name,
        email: ownerRole?.userId?.email,
        phone: ownerRole?.userId?.phone,
        registeredDate: org.createdAt,
        subscriptionPlan: org.subscription?.plan || 'Basic',
        subscriptionExpiry: org.subscription?.expiryDate,
        status: org.active ? 'Active' : 'Suspended'
      },
      branches: branchDetails
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch restaurant detail', error: error.message });
  }
};

/**
 * Get users for a specific branch
 */
const getBranchUsers = async (req, res) => {
  try {
    const { branchId } = req.params;
    const userRoles = await UserBranchRole.find({ branchId })
      .populate('userId', 'name email role lastLogin status createdAt')
      .lean();

    const users = userRoles.map(ur => ({
      id: ur.userId?._id,
      name: ur.userId?.name,
      email: ur.userId?.email,
      role: ur.role,
      lastLogin: ur.userId?.lastLogin || ur.userId?.updatedAt,
      status: ur.userId?.status || 'Active'
    }));

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch branch users', error: error.message });
  }
};

module.exports = {
  getPlatformStats,
  listRestaurants,
  getRestaurantDetail,
  getBranchUsers
};
