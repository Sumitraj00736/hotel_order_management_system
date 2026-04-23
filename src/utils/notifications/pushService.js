const PushSubscription = require('../../models/notifications/PushSubscription');

const { initFirebase, admin, isConfigured } = require('../firebase/admin');
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
  if (!tokens.length) return;
  const app = initFirebase();
  if (!app) return;
  const messaging = admin.messaging(app);
  try {
    const response = await messaging.sendEachForMulticast({ ...payload, tokens });
    console.log(`[PushService] Sent to ${tokens.length} tokens. Success: ${response.successCount}, Failure: ${response.failureCount}`);
    const invalidTokens = [];
    response.responses.forEach((res, idx) => {
      if (!res.success) {
        const code = res.error?.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
    await disableTokens(invalidTokens);
  } catch (err) {
    console.error('[PushService] Batch send failed:', err);
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
  await sendToTokens(tokens, payload);
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
  await sendToTokens(tokens, payload);
};

module.exports = { isConfigured, getPublicKey, sendPushToRole, sendPushToUser };
