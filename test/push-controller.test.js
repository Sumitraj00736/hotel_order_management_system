const test = require('node:test');
const assert = require('node:assert/strict');

const PushSubscription = require('../src/models/notifications/PushSubscription');
const pushService = require('../src/utils/notifications/pushService');
const activity = require('../src/utils/notifications/activity');
const pushController = require('../src/controllers/notifications/pushController');

function createResponse() {
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

test('subscribe stores push subscription and records audit log', async () => {
  const original = {
    updateMany: PushSubscription.updateMany,
    findOneAndUpdate: PushSubscription.findOneAndUpdate,
    logActivity: activity.logActivity
  };

  const recorded = { updateMany: null, findOneAndUpdate: null, audit: null };

  PushSubscription.updateMany = async (...args) => {
    recorded.updateMany = args;
    return { matchedCount: 0, modifiedCount: 0 };
  };
  PushSubscription.findOneAndUpdate = async (...args) => {
    recorded.findOneAndUpdate = args;
    return { _id: 'sub-1', enabled: true, provider: 'fcm' };
  };
  activity.logActivity = async (payload) => {
    recorded.audit = payload;
    return payload;
  };

  const req = {
    body: { fcmToken: 'token-1', deviceId: 'device-1', enabled: true, platform: 'web' },
    user: { _id: 'user-1', name: 'Admin' },
    branchId: 'branch-1',
    branchRole: 'admin',
    headers: { 'user-agent': 'CodexTest/1.0' },
    requestId: 'req-1',
    ip: '127.0.0.1'
  };
  const res = createResponse();

  try {
    await pushController.subscribe(req, res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { message: 'Subscribed', subscriptionId: 'sub-1', enabled: true });
    assert.deepEqual(recorded.updateMany, [
      { fcmToken: 'token-1', userId: { $ne: 'user-1' } },
      { enabled: false, fcmToken: null }
    ]);

    const [query, payload, options] = recorded.findOneAndUpdate;
    assert.deepEqual(query, { userId: 'user-1', deviceId: 'device-1', provider: 'fcm' });
    assert.equal(payload.userId, 'user-1');
    assert.equal(payload.branchId, 'branch-1');
    assert.equal(payload.role, 'admin');
    assert.equal(payload.fcmToken, 'token-1');
    assert.deepEqual(options, { upsert: true, new: true, setDefaultsOnInsert: true });

    assert.equal(recorded.audit.action, 'push.subscribe');
    assert.equal(recorded.audit.entityType, 'push-subscription');
    assert.equal(recorded.audit.entityId, 'sub-1');
    assert.equal(recorded.audit.metadata.deviceId, 'device-1');
  } finally {
    PushSubscription.updateMany = original.updateMany;
    PushSubscription.findOneAndUpdate = original.findOneAndUpdate;
    activity.logActivity = original.logActivity;
  }
});

test('testPush returns delivery summary and records audit log', async () => {
  const original = {
    find: PushSubscription.find,
    isConfigured: pushService.isConfigured,
    sendPushToUser: pushService.sendPushToUser,
    logActivity: activity.logActivity
  };

  const recorded = { audit: null, send: null };

  PushSubscription.find = async () => [{ _id: 'sub-1' }, { _id: 'sub-2' }];
  pushService.isConfigured = () => true;
  pushService.sendPushToUser = async (payload) => {
    recorded.send = payload;
    return {
      attempted: 2,
      successCount: 1,
      failureCount: 1,
      failureCodes: ['messaging/invalid-registration-token']
    };
  };
  activity.logActivity = async (payload) => {
    recorded.audit = payload;
    return payload;
  };

  const req = {
    body: { title: 'Hello', body: 'World' },
    user: { _id: 'user-1', name: 'Admin' },
    branchId: 'branch-1',
    requestId: 'req-2',
    ip: '127.0.0.1',
    headers: { 'user-agent': 'CodexTest/1.0' }
  };
  const res = createResponse();

  try {
    await pushController.testPush(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Push sent');
    assert.equal(res.body.count, 2);
    assert.deepEqual(res.body.delivery, {
      attempted: 2,
      successCount: 1,
      failureCount: 1,
      failureCodes: ['messaging/invalid-registration-token']
    });
    assert.deepEqual(recorded.send, {
      userId: 'user-1',
      title: 'Hello',
      body: 'World',
      data: { url: '/' }
    });
    assert.equal(recorded.audit.action, 'push.test');
    assert.equal(recorded.audit.metadata.successCount, 1);
    assert.equal(recorded.audit.metadata.failureCount, 1);
  } finally {
    PushSubscription.find = original.find;
    pushService.isConfigured = original.isConfigured;
    pushService.sendPushToUser = original.sendPushToUser;
    activity.logActivity = original.logActivity;
  }
});
