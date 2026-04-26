const PushSubscription = require('../../models/notifications/PushSubscription');

const { initFirebase, admin, isConfigured } = require('../firebase/admin');
const { emitLog } = require('../observability/logger');
const firebaseVapidKey = process.env.FIREBASE_VAPID_KEY || '';

const getPublicKey = () => firebaseVapidKey;

const normalizeData = (data) => {
  if (!data) return {};
  const out = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    out[key] = typeof value === 'string' ? value : JSON.stringify(value);
  });
  return out;
};

const disableTokens = async (tokens) => {
  if (!tokens.length) return;
  await PushSubscription.updateMany({ fcmToken: { $in: tokens } }, { enabled: false });
};

const sendToTokens = async (tokens, payload) => {
  if (!tokens.length) {
    emitLog({ level: 'warn', message: 'Push send skipped: no tokens available', type: 'push' });
    return { attempted: 0, successCount: 0, failureCount: 0, invalidTokens: [] };
  }
  const app = initFirebase();
  if (!app) {
    emitLog({ level: 'warn', message: 'Push send skipped: Firebase app unavailable', type: 'push' });
    return { attempted: tokens.length, successCount: 0, failureCount: tokens.length, invalidTokens: [] };
  }
  const messaging = admin.messaging(app);
  try {
    const response = await messaging.sendEachForMulticast({ ...payload, tokens });
    emitLog({
      level: response.failureCount > 0 ? 'warn' : 'info',
      message: 'Push multicast completed',
      type: 'push',
      attempted: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount
    });
    const invalidTokens = [];
    const failureCodes = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code;
        if (code) failureCodes.push(code);
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
    await disableTokens(invalidTokens);
    if (invalidTokens.length) {
      emitLog({
        level: 'warn',
        message: 'Disabled invalid push tokens',
        type: 'push',
        invalidTokenCount: invalidTokens.length
      });
    }
    return {
      attempted: tokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
      failureCodes
    };
  } catch (err) {
    emitLog({
      level: 'error',
      message: 'Push multicast failed',
      type: 'push',
      attempted: tokens.length,
      error: { message: err.message, stack: err.stack }
    });
    return {
      attempted: tokens.length,
      successCount: 0,
      failureCount: tokens.length,
      invalidTokens: [],
      failureCodes: [err.message]
    };
  }
};

const sendPushToRole = async ({ branchId, role, title, body, data }) => {
  if (!isConfigured()) return;
  const subscriptions = await PushSubscription.find({
    branchId,
    role: role?.toLowerCase(),
    enabled: true,
    provider: 'fcm',
    fcmToken: { $exists: true, $ne: '' }
  }).lean();
  const tokens = subscriptions.map((sub) => sub.fcmToken).filter(Boolean);
  const payload = {
    notification: { 
      title: title || 'Notification', 
      body: body || '',
    },
    android: {
      notification: {
        sound: 'default',
        priority: 'high'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    },
    data: normalizeData(data)
  };
  return sendToTokens(tokens, payload);
};

const sendPushToUser = async ({ userId, title, body, data }) => {
  if (!isConfigured()) return;
  const subscriptions = await PushSubscription.find({
    userId,
    enabled: true,
    provider: 'fcm',
    fcmToken: { $exists: true, $ne: '' }
  }).lean();
  const tokens = subscriptions.map((sub) => sub.fcmToken).filter(Boolean);
  const payload = {
    notification: { 
      title: title || 'Notification', 
      body: body || '',
    },
    android: {
      notification: {
        sound: 'default',
        priority: 'high'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: 'default'
        }
      }
    },
    data: normalizeData(data)
  };
  return sendToTokens(tokens, payload);
};

module.exports = { isConfigured, getPublicKey, sendPushToRole, sendPushToUser };
