const Organization = require('../../models/core/Organization');
const Branch = require('../../models/core/Branch');
const Subscription = require('../../models/platform/Subscription');
const SubscriptionHistory = require('../../models/platform/SubscriptionHistory');
const User = require('../../models/users/User');
const UserBranchRole = require('../../models/users/UserBranchRole');
const ActivityLog = require('../../models/notifications/ActivityLog');
const Order = require('../../models/orders/Order');
const MenuItem = require('../../models/menu/MenuItem');
const Table = require('../../models/tables/Table');
const Customer = require('../../models/customers/Customer');
const { buildActivityPayload } = require('../../utils/notifications/activity');
const { PLAN_LIMIT_KEYS, PLAN_PRESETS, normalizeTier, applyPlanOverrides } = require('./planPresets');

const DEFAULT_PAGE_SIZE = 10;

const formatDate = (value) => (value ? new Date(value).toISOString() : null);

const formatStatus = (active, archivedAt) => (active === false || archivedAt ? 'Archived' : 'Active');

const summarizeBranchPlans = (branches) => {
  const plans = branches
    .map((branch) => {
      const sub = branch.subscription;
      if (!sub) return null;
      return {
        id: sub.planId ? String(sub.planId) : 'legacy',
        name: sub.planName || 'Free Plan'
      };
    })
    .filter(Boolean);

  if (!plans.length) {
    return {
      label: 'No Branches',
      planId: 'none',
      tier: 'none',
      mixed: false
    };
  }

  const distinctIds = [...new Set(plans.map(p => p.id))];
  if (distinctIds.length > 1) {
    return {
      label: 'Mixed / Custom',
      planId: 'mixed',
      tier: 'mixed',
      mixed: true
    };
  }

  return {
    label: plans[0].name,
    planId: plans[0].id,
    tier: plans[0].name.toLowerCase().replace(/\s+/g, '-'),
    mixed: false
  };
};


const getSortValue = (row, sortBy) => {
  switch (sortBy) {
    case 'branchesCount':
      return row.branchesCount;
    case 'usersCount':
      return row.usersCount;
    case 'plan':
      return row.planSummary.label;
    case 'createdAt':
      return row.createdAt;
    default:
      return row.name;
  }
};

const createRoleMaps = async (orgIds, branchIds) => {
  const roleFilter = {};
  if (orgIds?.length) {
    roleFilter.orgId = { $in: orgIds };
  } else if (branchIds?.length) {
    roleFilter.branchId = { $in: branchIds };
  }

  const roles = await UserBranchRole.find(roleFilter)
    .populate('userId', 'name email phone isPlatformAdmin role')
    .lean();

  const rolesByOrg = new Map();
  const rolesByBranch = new Map();

  roles.forEach((role) => {
    if (role.orgId) {
      const key = String(role.orgId);
      const current = rolesByOrg.get(key) || [];
      current.push(role);
      rolesByOrg.set(key, current);
    }
    if (role.branchId) {
      const key = String(role.branchId);
      const current = rolesByBranch.get(key) || [];
      current.push(role);
      rolesByBranch.set(key, current);
    }
  });

  return { rolesByOrg, rolesByBranch };
};

const pickPrimaryContact = (roles = []) =>
  roles.find((role) => role.isOwner && role.userId) ||
  roles.find((role) => role.role === 'superadmin' && role.userId) ||
  roles.find((role) => role.role === 'admin' && role.userId) ||
  roles.find((role) => role.userId);

const formatAuditItem = (item) => ({
  id: String(item._id),
  title: item.title,
  type: item.type || null,
  action: item.action || null,
  description: item.description || '',
  entityType: item.entityType || null,
  entityId: item.entityId || null,
  branchId: item.branchId ? String(item.branchId) : null,
  orgId: item.orgId ? String(item.orgId) : null,
  createdAt: formatDate(item.createdAt),
  performedBy: item.performedBy
    ? {
        id: String(item.performedBy._id),
        name: item.performedBy.name,
        email: item.performedBy.email
      }
    : null,
  metadata: item.metadata || {}
});

const serializeSubscription = (subscription, usage = null) => {
  const source = subscription || PLAN_PRESETS.free;
  return {
    id: subscription?._id ? String(subscription._id) : null,
    tier: normalizeTier(source.tier || source.planName || 'free'),
    planName: source.planName || 'Free Plan',
    status: source.status || 'active',
    activeSince: formatDate(source.activeSince),
    limits: Object.fromEntries(
      PLAN_LIMIT_KEYS.map((key) => [key, Number(source[key] ?? 0)])
    ),
    usage
  };
};

const ensureSubscription = async (branchId) => {
  let subscription = await Subscription.findOne({ branchId });
  if (!subscription) {
    subscription = await Subscription.create({ branchId });
  }
  return subscription;
};

const buildBranchUsageMap = async (branchIds) => {
  const [memberCounts, tableCounts, dishCounts, customerCounts] = await Promise.all([
    UserBranchRole.aggregate([
      { $match: { branchId: { $in: branchIds }, status: 'active' } },
      { $group: { _id: '$branchId', total: { $sum: 1 } } }
    ]),
    Table.aggregate([
      { $match: { branchId: { $in: branchIds }, isTrashed: { $ne: true } } },
      { $group: { _id: '$branchId', total: { $sum: 1 } } }
    ]),
    MenuItem.aggregate([
      { $match: { branchId: { $in: branchIds } } },
      { $group: { _id: '$branchId', total: { $sum: 1 } } }
    ]),
    Customer.aggregate([
      { $match: { branchId: { $in: branchIds } } },
      { $group: { _id: '$branchId', total: { $sum: 1 } } }
    ])
  ]);

  const usageMap = new Map();
  branchIds.forEach((id) => {
    usageMap.set(String(id), {
      members: 0,
      tables: 0,
      dishes: 0,
      customers: 0
    });
  });

  const fillMap = (counts, key) => {
    counts.forEach((entry) => {
      const current = usageMap.get(String(entry._id)) || {};
      current[key] = entry.total;
      usageMap.set(String(entry._id), current);
    });
  };

  fillMap(memberCounts, 'members');
  fillMap(tableCounts, 'tables');
  fillMap(dishCounts, 'dishes');
  fillMap(customerCounts, 'customers');

  return usageMap;
};

const buildRestaurantRows = async (organizations) => {
  const orgIds = organizations.map((org) => org._id);
  const branches = await Branch.find({ orgId: { $in: orgIds } }).sort({ name: 1 }).lean();
  const branchIds = branches.map((branch) => branch._id);
  const subscriptions = branchIds.length
    ? await Subscription.find({ branchId: { $in: branchIds } }).lean()
    : [];
  const userCounts = branchIds.length
    ? await UserBranchRole.aggregate([
        { $match: { branchId: { $in: branchIds }, status: 'active' } },
        { $group: { _id: '$branchId', total: { $sum: 1 } } }
      ])
    : [];
  const { rolesByOrg } = await createRoleMaps(orgIds, branchIds);

  const branchesByOrg = new Map();
  branches.forEach((branch) => {
    const key = String(branch.orgId);
    const current = branchesByOrg.get(key) || [];
    current.push(branch);
    branchesByOrg.set(key, current);
  });

  const subscriptionByBranch = new Map(
    subscriptions.map((subscription) => [String(subscription.branchId), subscription])
  );
  const userCountByBranch = new Map(
    userCounts.map((entry) => [String(entry._id), entry.total])
  );

  return organizations.map((org) => {
    const orgBranches = (branchesByOrg.get(String(org._id)) || []).map((branch) => ({
      ...branch,
      usersCount: userCountByBranch.get(String(branch._id)) || 0,
      subscription: subscriptionByBranch.get(String(branch._id)) || null
    }));

    const planSummary = summarizeBranchPlans(orgBranches);
    const totalUsers = orgBranches.reduce((sum, branch) => sum + (branch.usersCount || 0), 0);
    const primaryRole = pickPrimaryContact(rolesByOrg.get(String(org._id)) || []);
    const owner = primaryRole?.userId || null;

    return {
      id: String(org._id),
      name: org.name,
      slug: org.slug || null,
      owner: owner?.name || 'Unknown',
      ownerEmail: owner?.email || org.billingEmail || '',
      ownerPhone: owner?.phone || '',
      billingEmail: org.billingEmail || '',
      branchesCount: orgBranches.length,
      usersCount: totalUsers,
      status: formatStatus(org.active, org.archivedAt),
      archivedAt: formatDate(org.archivedAt),
      createdAt: formatDate(org.createdAt),
      planSummary,
      branches: orgBranches
    };
  });
};

const filterAndPaginateRows = (rows, query) => {
  const {
    search = '',
    status = 'active',
    plan_id = 'all',
    sortBy = 'name',
    sortDir = 'asc'
  } = query;
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || DEFAULT_PAGE_SIZE, 1), 100);
  const normalizedSearch = String(search).trim().toLowerCase();
  const normalizedStatus = String(status || 'active').toLowerCase();

  let filtered = rows.filter((row) => {
    if (normalizedStatus === 'active' && row.status !== 'Active') return false;
    if (normalizedStatus === 'archived' && row.status !== 'Archived') return false;
    if (normalizedStatus !== 'all' && normalizedStatus !== 'active' && normalizedStatus !== 'archived') return false;
    if (plan_id !== 'all' && row.planSummary.planId !== plan_id) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      row.name,
      row.owner,
      row.ownerEmail,
      row.billingEmail,
      row.planSummary.label
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  filtered = filtered.sort((a, b) => {
    const left = getSortValue(a, sortBy);
    const right = getSortValue(b, sortBy);
    if (left === right) return 0;
    const comparison = left > right ? 1 : -1;
    return String(sortDir).toLowerCase() === 'desc' ? comparison * -1 : comparison;
  });

  const start = (page - 1) * limit;
  return {
    data: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit
  };
};

const getPlatformStats = async (req, res) => {
  try {
    const Plan = require('../../models/platform/Plan');
    
    // Time boundaries for percentage changes
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    // Helper to get counts with date filters
    const getCount = async (model, filter = {}, sinceDate = null, untilDate = null) => {
      const dateFilter = {};
      if (sinceDate) dateFilter.$gte = sinceDate;
      if (untilDate) dateFilter.$lt = untilDate;
      
      const finalFilter = { ...filter };
      // Assuming 'createdAt' is the timestamp field for most models
      if (Object.keys(dateFilter).length > 0) {
        finalFilter.createdAt = dateFilter;
      }
      return model.countDocuments(finalFilter);
    };

    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    // 1. Total Restaurants
    const currentRestaurants = await getCount(Organization);
    const oldRestaurants = await getCount(Organization, {}, sixtyDaysAgo, thirtyDaysAgo);
    const newRestaurants = await getCount(Organization, {}, thirtyDaysAgo, now);

    // 2. Total Plans (Active)
    const currentPlans = await Plan.countDocuments({ is_active: true, is_deleted: false });

    // 3. Total Active Subscriptions
    const currentSubscriptions = await Subscription.countDocuments({ status: 'active' });
    const oldSubscriptions = await getCount(Subscription, { status: 'active' }, sixtyDaysAgo, thirtyDaysAgo);
    const newSubscriptions = await getCount(Subscription, { status: 'active' }, thirtyDaysAgo, now);

    // 4. Total Registered Users
    const currentUsers = await User.countDocuments();
    const oldUsers = await getCount(User, {}, sixtyDaysAgo, thirtyDaysAgo);
    const newUsers = await getCount(User, {}, thirtyDaysAgo, now);

    // 5 & 6. Free vs Paid Users
    // A simplified approach: count subscriptions where planName includes 'Free' or tier is 'free'
    const freePlanCount = await Subscription.countDocuments({ status: 'active', tier: 'free' });
    const paidPlanCount = await Subscription.countDocuments({ status: 'active', tier: { $ne: 'free' } });

    return res.json({
      total_restaurants: currentRestaurants,
      total_plans: currentPlans,
      active_subscriptions: currentSubscriptions,
      registered_users: currentUsers,
      free_plan_users: freePlanCount,
      paid_plan_users: paidPlanCount,
      changes: {
        total_restaurants: calculateChange(newRestaurants, oldRestaurants),
        active_subscriptions: calculateChange(newSubscriptions, oldSubscriptions),
        registered_users: calculateChange(newUsers, oldUsers)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch platform stats', error: error.message });
  }
};


const listRestaurants = async (req, res) => {
  try {
    const organizations = await Organization.find().lean();
    const rows = await buildRestaurantRows(organizations);
    const result = filterAndPaginateRows(rows, req.query);

    return res.json({
      data: result.data.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        owner: row.owner,
        ownerEmail: row.ownerEmail,
        ownerPhone: row.ownerPhone,
        branchesCount: row.branchesCount,
        usersCount: row.usersCount,
        status: row.status,
        archivedAt: row.archivedAt,
        createdAt: row.createdAt,
        effectivePlan: row.planSummary
      })),
      total: result.total,
      page: result.page,
      limit: result.limit
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to list restaurants', error: error.message });
  }
};

const exportRestaurantsCSV = async (req, res) => {
  try {
    const organizations = await Organization.find().lean();
    const rows = await buildRestaurantRows(organizations);
    
    // We ignore pagination for export, but keep filtering
    const queryForExport = { ...req.query, page: 1, limit: 1000000 }; 
    const result = filterAndPaginateRows(rows, queryForExport);

    const data = result.data;

    // CSV Header
    let csvStr = 'ID,Name,Owner,Owner Email,Branches Count,Users Count,Plan,Status,Joined Date\n';

    data.forEach(row => {
      // Basic escaping for CSV fields
      const escape = (str) => `"${String(str || '').replace(/"/g, '""')}"`;
      
      // Mask sensitive data
      const maskEmail = (email) => {
        if (!email) return '';
        const parts = email.split('@');
        if (parts.length !== 2) return email;
        const name = parts[0];
        if (name.length <= 2) return `*@${parts[1]}`;
        return `${name.substring(0, 2)}***@${parts[1]}`;
      };

      csvStr += [
        escape(row.id),
        escape(row.name),
        escape(row.owner),
        escape(maskEmail(row.ownerEmail)),
        escape(row.branchesCount),
        escape(row.usersCount),
        escape(row.planSummary.label),
        escape(row.status),
        escape(row.createdAt)
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="restaurants_export.csv"');
    
    return res.send(csvStr);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to export restaurants', error: error.message });
  }
};

const getRestaurantDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await Organization.findById(id).lean();
    if (!org) return res.status(404).json({ message: 'Restaurant not found' });

    const branches = await Branch.find({ orgId: org._id }).sort({ name: 1 }).lean();
    const branchIds = branches.map((branch) => branch._id);
    const [subscriptions, usageMap, branchRoles, orgRoles, history, audits] = await Promise.all([
      branchIds.length ? Subscription.find({ branchId: { $in: branchIds } }).lean() : [],
      branchIds.length ? buildBranchUsageMap(branchIds) : new Map(),
      branchIds.length
        ? UserBranchRole.find({ branchId: { $in: branchIds } })
            .populate('userId', 'name email phone role')
            .lean()
        : [],
      UserBranchRole.find({ orgId: org._id }).populate('userId', 'name email phone role').lean(),
      branchIds.length
        ? SubscriptionHistory.find({ branchId: { $in: branchIds } }).sort({ purchaseDate: -1 }).limit(50).lean()
        : [],
      ActivityLog.find({
        $or: [
          { orgId: org._id },
          { branchId: { $in: branchIds } }
        ]
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('performedBy', 'name email')
        .lean()
    ]);

    const subscriptionByBranch = new Map(
      subscriptions.map((subscription) => [String(subscription.branchId), subscription])
    );
    const branchRolesByBranch = new Map();
    branchRoles.forEach((role) => {
      const key = String(role.branchId);
      const current = branchRolesByBranch.get(key) || [];
      current.push(role);
      branchRolesByBranch.set(key, current);
    });

    const branchDetails = branches.map((branch) => {
      const roles = branchRolesByBranch.get(String(branch._id)) || [];
      const primaryManager = pickPrimaryContact(
        roles.filter((role) => ['admin', 'superadmin'].includes(role.role))
      );
      const subscription = subscriptionByBranch.get(String(branch._id)) || null;
      const usage = usageMap.get(String(branch._id)) || { members: 0 };

      return {
        id: String(branch._id),
        name: branch.name,
        code: branch.code || '',
        location: branch.address || '',
        timezone: branch.timezone,
        status: branch.active ? 'Active' : 'Archived',
        settings: branch.settings || {},
        websiteSettings: branch.websiteSettings || {},
        manager: primaryManager?.userId?.name || 'N/A',
        managerEmail: primaryManager?.userId?.email || '',
        managerPhone: primaryManager?.userId?.phone || '',
        usersCount: usage.members || 0,
        subscription: serializeSubscription(subscription, usage)
      };
    });

    const planSummary = summarizeBranchPlans(branchDetails);
    const ownerRole = pickPrimaryContact(orgRoles);

    return res.json({
      restaurant: {
        id: String(org._id),
        name: org.name,
        slug: org.slug || '',
        billingEmail: org.billingEmail || '',
        owner: ownerRole?.userId?.name || 'Unknown',
        email: ownerRole?.userId?.email || org.billingEmail || '',
        phone: ownerRole?.userId?.phone || '',
        registeredDate: formatDate(org.createdAt),
        updatedAt: formatDate(org.updatedAt),
        status: formatStatus(org.active, org.archivedAt),
        archivedAt: formatDate(org.archivedAt),
        effectivePlan: planSummary,
        branchesCount: branchDetails.length,
        totalUsers: branchDetails.reduce((sum, branch) => sum + branch.usersCount, 0)
      },
      branches: branchDetails,
      planPresets: Object.values(PLAN_PRESETS),
      subscriptionHistory: history.map((item) => ({
        id: String(item._id),
        branchId: String(item.branchId),
        planName: item.planName,
        purchaseDate: formatDate(item.purchaseDate),
        expiryDate: formatDate(item.expiryDate),
        remarks: item.remarks || ''
      })),
      recentAudit: audits.map(formatAuditItem)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch restaurant detail', error: error.message });
  }
};

const getBranchUsers = async (req, res) => {
  try {
    const { branchId } = req.params;
    const userRoles = await UserBranchRole.find({ branchId })
      .populate('userId', 'name email role phone updatedAt')
      .lean();

    const users = userRoles
      .filter((role) => role.userId)
      .map((role) => ({
        id: String(role.userId._id),
        name: role.userId.name,
        email: role.userId.email,
        phone: role.userId.phone || '',
        role: role.role,
        lastLogin: role.userId.updatedAt || role.updatedAt || role.createdAt,
        status: role.status === 'active' ? 'Active' : 'Inactive'
      }));

    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch branch users', error: error.message });
  }
};

const updateBranchSubscription = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { tier, remarks = '', expiryDate = null, ...overrides } = req.body || {};
    const branch = await Branch.findById(branchId);
    if (!branch) return res.status(404).json({ message: 'Branch not found' });

    const effectivePlan = applyPlanOverrides(tier, overrides);
    const subscription = await ensureSubscription(branchId);

    subscription.tier = effectivePlan.tier;
    subscription.planName = effectivePlan.planName;
    subscription.status = 'active';
    subscription.expiryDate = expiryDate ? new Date(expiryDate) : null;
    subscription.features = effectivePlan.features || {};
    PLAN_LIMIT_KEYS.forEach((key) => {
      subscription[key] = effectivePlan[key];
    });
    await subscription.save();

    await SubscriptionHistory.create({
      branchId,
      planName: effectivePlan.planName,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      remarks
    });

    await ActivityLog.create(buildActivityPayload({
      req,
      branchId,
      orgId: branch.orgId,
      title: 'Branch subscription updated',
      type: 'platform-admin',
      action: 'subscription-update',
      description: `${req.user?.name || 'Platform admin'} updated ${branch.name} to ${effectivePlan.planName}.`,
      performedBy: req.user?._id,
      entityType: 'subscription',
      entityId: branchId,
      metadata: {
        tier: effectivePlan.tier,
        remarks,
        limits: Object.fromEntries(PLAN_LIMIT_KEYS.map((key) => [key, effectivePlan[key]]))
      }
    }));

    return res.json({
      message: 'Branch subscription updated',
      subscription: serializeSubscription(subscription)
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update branch subscription', error: error.message });
  }
};

const updateRestaurantArchiveState = async ({ req, res, archived }) => {
  try {
    const { id } = req.params;
    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ message: 'Restaurant not found' });

    org.active = !archived;
    org.archivedAt = archived ? new Date() : null;
    org.archivedBy = archived ? req.user?._id || null : null;
    await org.save();

    const branches = await Branch.find({ orgId: org._id });
    await Promise.all(
      branches.map(async (branch) => {
        branch.active = !archived;
        await branch.save();
      })
    );

    await ActivityLog.create(buildActivityPayload({
      req,
      orgId: org._id,
      title: archived ? 'Restaurant archived' : 'Restaurant restored',
      type: 'platform-admin',
      action: archived ? 'restaurant-archive' : 'restaurant-restore',
      description: `${req.user?.name || 'Platform admin'} ${archived ? 'archived' : 'restored'} ${org.name}.`,
      performedBy: req.user?._id,
      entityType: 'organization',
      entityId: org._id,
      metadata: {
        branchCount: branches.length
      }
    }));

    await Promise.all(
      branches.map((branch) =>
        ActivityLog.create(buildActivityPayload({
          req,
          branchId: branch._id,
          orgId: org._id,
          title: archived ? 'Branch archived with restaurant' : 'Branch restored with restaurant',
          type: 'platform-admin',
          action: archived ? 'branch-archive' : 'branch-restore',
          description: `${branch.name} was ${archived ? 'archived' : 'restored'} through restaurant-level control.`,
          performedBy: req.user?._id,
          entityType: 'branch',
          entityId: branch._id,
          metadata: {
            restaurantId: String(org._id)
          }
        }))
      )
    );

    return res.json({
      message: archived ? 'Restaurant archived' : 'Restaurant restored',
      restaurant: {
        id: String(org._id),
        status: formatStatus(org.active, org.archivedAt),
        archivedAt: formatDate(org.archivedAt)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update restaurant status', error: error.message });
  }
};

const archiveRestaurant = async (req, res) => updateRestaurantArchiveState({ req, res, archived: true });

const restoreRestaurant = async (req, res) => updateRestaurantArchiveState({ req, res, archived: false });

const getRestaurantAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const org = await Organization.findById(id).lean();
    if (!org) return res.status(404).json({ message: 'Restaurant not found' });

    const branches = await Branch.find({ orgId: org._id }).select('_id').lean();
    const branchIds = branches.map((branch) => branch._id);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    const filter = {
      $or: [
        { orgId: org._id },
        { branchId: { $in: branchIds } }
      ]
    };

    const [items, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('performedBy', 'name email')
        .lean(),
      ActivityLog.countDocuments(filter)
    ]);

    return res.json({
      data: items.map(formatAuditItem),
      total,
      page,
      limit
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch restaurant audit', error: error.message });
  }
};

module.exports = {
  getPlatformStats,
  listRestaurants,
  exportRestaurantsCSV,
  getRestaurantDetail,
  getBranchUsers,
  updateBranchSubscription,
  archiveRestaurant,
  restoreRestaurant,
  getRestaurantAudit
};
