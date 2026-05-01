const test = require('node:test');
const assert = require('node:assert/strict');

const Organization = require('../src/models/core/Organization');
const Branch = require('../src/models/core/Branch');
const Subscription = require('../src/models/core/Subscription');
const SubscriptionHistory = require('../src/models/core/SubscriptionHistory');
const UserBranchRole = require('../src/models/users/UserBranchRole');
const ActivityLog = require('../src/models/notifications/ActivityLog');
const controller = require('../src/controllers/honor/honorAdminController');

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function withPatched(target, patches, fn) {
  const original = {};
  Object.keys(patches).forEach((key) => {
    original[key] = target[key];
    target[key] = patches[key];
  });
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      Object.keys(original).forEach((key) => {
        target[key] = original[key];
      });
    });
}

test('listRestaurants returns effective plan data with filtering and pagination', async () => {
  await withPatched(Organization, {
    find: () => ({
      lean: async () => [
        { _id: 'org-1', name: 'Janaki Cafe', billingEmail: 'billing@janaki.test', active: true, archivedAt: null, createdAt: new Date('2026-01-01') },
        { _id: 'org-2', name: 'Heritage Hotel', billingEmail: 'billing@heritage.test', active: false, archivedAt: new Date('2026-02-01'), createdAt: new Date('2026-01-10') }
      ]
    })
  }, async () => withPatched(Branch, {
    find: () => ({
      sort: () => ({
        lean: async () => [
          { _id: 'branch-1', orgId: 'org-1', name: 'Janaki Main', active: true },
          { _id: 'branch-2', orgId: 'org-1', name: 'Janaki North', active: true },
          { _id: 'branch-3', orgId: 'org-2', name: 'Heritage Main', active: false }
        ]
      })
    })
  }, async () => withPatched(Subscription, {
    find: () => ({
      lean: async () => [
        { branchId: 'branch-1', tier: 'basic', planName: 'Basic' },
        { branchId: 'branch-2', tier: 'pro', planName: 'Pro' },
        { branchId: 'branch-3', tier: 'enterprise', planName: 'Enterprise' }
      ]
    })
  }, async () => withPatched(UserBranchRole, {
    aggregate: async () => [
      { _id: 'branch-1', total: 5 },
      { _id: 'branch-2', total: 4 },
      { _id: 'branch-3', total: 10 }
    ],
    find: () => ({
      populate: () => ({
        lean: async () => [
          { orgId: 'org-1', branchId: 'branch-1', role: 'superadmin', isOwner: true, userId: { name: 'Owner One', email: 'owner1@test.com', phone: '111' } },
          { orgId: 'org-2', branchId: 'branch-3', role: 'admin', isOwner: false, userId: { name: 'Owner Two', email: 'owner2@test.com', phone: '222' } }
        ]
      })
    })
  }, async () => {
    const req = {
      query: {
        status: 'all',
        search: 'janaki',
        page: '1',
        limit: '5'
      }
    };
    const res = createRes();

    await controller.listRestaurants(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.data[0].name, 'Janaki Cafe');
    assert.equal(res.body.data[0].branchesCount, 2);
    assert.equal(res.body.data[0].usersCount, 9);
    assert.equal(res.body.data[0].effectivePlan.tier, 'mixed');
    assert.equal(res.body.data[0].status, 'Active');
  }))));
});

test('updateBranchSubscription applies preset with overrides and writes history', async () => {
  const saved = { called: false };
  const createdHistory = [];
  const createdActivity = [];
  const subscriptionDoc = {
    tier: 'free',
    planName: 'Free Plan',
    status: 'active',
    maxMembers: 2,
    maxTables: 10,
    maxCustomers: 10,
    maxDishes: 100,
    maxAddOns: 5,
    maxSpaces: 0,
    save: async () => {
      saved.called = true;
    }
  };

  await withPatched(Branch, {
    findById: async () => ({ _id: 'branch-1', orgId: 'org-1', name: 'Janaki Main' })
  }, async () => withPatched(Subscription, {
    findOne: async () => subscriptionDoc
  }, async () => withPatched(SubscriptionHistory, {
    create: async (payload) => {
      createdHistory.push(payload);
      return payload;
    }
  }, async () => withPatched(ActivityLog, {
    create: async (payload) => {
      createdActivity.push(payload);
      return payload;
    }
  }, async () => {
    const req = {
      params: { branchId: 'branch-1' },
      body: {
        tier: 'pro',
        maxMembers: 25,
        remarks: 'VIP upgrade'
      },
      user: {
        _id: 'user-1',
        name: 'Platform Admin'
      },
      headers: {},
      ip: '127.0.0.1'
    };
    const res = createRes();

    await controller.updateBranchSubscription(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(saved.called, true);
    assert.equal(subscriptionDoc.tier, 'pro');
    assert.equal(subscriptionDoc.planName, 'Pro');
    assert.equal(subscriptionDoc.maxMembers, 25);
    assert.equal(subscriptionDoc.maxTables, 50);
    assert.equal(createdHistory.length, 1);
    assert.equal(createdHistory[0].planName, 'Pro');
    assert.equal(createdActivity.length, 1);
    assert.equal(createdActivity[0].action, 'subscription-update');
  }))));
});

test('archiveRestaurant disables restaurant and branches and records audit items', async () => {
  const orgDoc = {
    _id: 'org-1',
    name: 'Janaki Cafe',
    active: true,
    archivedAt: null,
    archivedBy: null,
    save: async function save() {
      return this;
    }
  };
  const branches = [
    {
      _id: 'branch-1',
      name: 'Janaki Main',
      active: true,
      save: async function save() {
        return this;
      }
    },
    {
      _id: 'branch-2',
      name: 'Janaki North',
      active: true,
      save: async function save() {
        return this;
      }
    }
  ];
  const auditItems = [];

  await withPatched(Organization, {
    findById: async () => orgDoc
  }, async () => withPatched(Branch, {
    find: async () => branches
  }, async () => withPatched(ActivityLog, {
    create: async (payload) => {
      auditItems.push(payload);
      return payload;
    }
  }, async () => {
    const req = {
      params: { id: 'org-1' },
      user: { _id: 'admin-1', name: 'Platform Admin' },
      headers: {},
      ip: '127.0.0.1'
    };
    const res = createRes();

    await controller.archiveRestaurant(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(orgDoc.active, false);
    assert.ok(orgDoc.archivedAt instanceof Date);
    assert.equal(branches.every((branch) => branch.active === false), true);
    assert.equal(auditItems.length, 3);
    assert.equal(auditItems[0].action, 'restaurant-archive');
  })));
});
