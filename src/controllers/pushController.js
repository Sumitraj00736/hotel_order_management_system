const PushSubscription = require('../models/PushSubscription');
const { getPublicKey, isConfigured, sendPushToUser } = require('../utils/pushService');

const getPublicKeyController = async (req, res) => {
  return res.json({ publicKey: getPublicKey() });
};

const getFirebaseConfig = async (req, res) => {
  return res.json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    vapidKey: getPublicKey()
  });
};

const subscribe = async (req, res) => {
  const { fcmToken, deviceId, enabled = true, platform = 'web' } = req.body || {};
  if (!fcmToken) {
    return res.status(400).json({ message: 'fcmToken required' });
  }
  if (!deviceId) {
    return res.status(400).json({ message: 'deviceId required' });
  }

  await PushSubscription.updateMany(
    { fcmToken, userId: { $ne: req.user._id } },
    { enabled: false, fcmToken: null }
  );

  const payload = {
    userId: req.user._id,
    branchId: req.branchId,
    role: req.branchRole || req.user?.role,
    provider: 'fcm',
    platform,
    deviceId,
    fcmToken,
    userAgent: req.headers['user-agent'],
    enabled: Boolean(enabled)
  };

  const doc = await PushSubscription.findOneAndUpdate(
    { userId: req.user._id, deviceId, provider: 'fcm' },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({ message: 'Subscribed', subscriptionId: doc._id, enabled: doc.enabled });
};

const unsubscribe = async (req, res) => {
  const { deviceId, fcmToken } = req.body || {};
  if (!deviceId && !fcmToken) {
    return res.status(400).json({ message: 'deviceId or fcmToken required' });
  }
  await PushSubscription.updateMany(
    { userId: req.user._id, ...(deviceId ? { deviceId } : {}), ...(fcmToken ? { fcmToken } : {}) },
    { enabled: false }
  );
  return res.json({ message: 'Unsubscribed' });
};

const toggle = async (req, res) => {
  const { deviceId, enabled } = req.body || {};
  if (!deviceId || typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'deviceId and enabled required' });
  }
  const doc = await PushSubscription.findOneAndUpdate(
    { userId: req.user._id, deviceId, provider: 'fcm' },
    { enabled },
    { new: true }
  );
  if (!doc) {
    return res.status(404).json({ message: 'Subscription not found' });
  }
  return res.json({ enabled: doc.enabled });
};

const status = async (req, res) => {
  const deviceId = req.query.deviceId || req.body?.deviceId;
  if (!deviceId) {
    return res.status(400).json({ message: 'deviceId required' });
  }
  const doc = await PushSubscription.findOne({ userId: req.user._id, deviceId, provider: 'fcm' });
  if (!doc) return res.json({ exists: false, enabled: false });
  return res.json({ exists: true, enabled: doc.enabled });
};

const testPush = async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Push not configured' });
  }
  const { title, body } = req.body || {};
  const enabledSubs = await PushSubscription.find({ userId: req.user._id, enabled: true, provider: 'fcm' });
  if (!enabledSubs.length) {
    return res.status(404).json({ message: 'No enabled subscriptions for this device' });
  }
  await sendPushToUser({
    userId: req.user._id,
    title: title || 'Test Notification',
    body: body || 'This is a test push from MeroRestro',
    data: { url: '/' }
  });
  return res.json({ message: 'Push sent', count: enabledSubs.length });
};

module.exports = {
  subscribe,
  unsubscribe,
  toggle,
  status,
  getPublicKeyController,
  getFirebaseConfig,
  testPush
};
