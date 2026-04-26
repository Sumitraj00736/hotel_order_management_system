const PushSubscription = require('../../models/notifications/PushSubscription');
const pushService = require('../../utils/notifications/pushService');
const activityService = require('../../utils/notifications/activity');

const getPublicKeyController = async (req, res) => {
  return res.json({ publicKey: pushService.getPublicKey() });
};

const getFirebaseConfig = async (req, res) => {
  return res.json({
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    vapidKey: pushService.getPublicKey()
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

  await activityService.logActivity({
    req,
    branchId: req.branchId,
    title: 'Push subscription updated',
    type: 'Push Subscription',
    action: 'push.subscribe',
    description: `${req.user?.name || 'User'} subscribed device ${deviceId} for push notifications.`,
    performedBy: req.user?._id,
    entityType: 'push-subscription',
    entityId: doc._id,
    metadata: {
      platform,
      enabled: doc.enabled,
      deviceId,
      provider: doc.provider
    }
  });

  return res.json({ message: 'Subscribed', subscriptionId: doc._id, enabled: doc.enabled });
};

const unsubscribe = async (req, res) => {
  const { deviceId, fcmToken } = req.body || {};
  if (!deviceId && !fcmToken) {
    return res.status(400).json({ message: 'deviceId or fcmToken required' });
  }
  const result = await PushSubscription.updateMany(
    { userId: req.user._id, ...(deviceId ? { deviceId } : {}), ...(fcmToken ? { fcmToken } : {}) },
    { enabled: false }
  );
  await activityService.logActivity({
    req,
    branchId: req.branchId,
    title: 'Push subscription disabled',
    type: 'Push Subscription',
    action: 'push.unsubscribe',
    description: `${req.user?.name || 'User'} unsubscribed a push device.`,
    performedBy: req.user?._id,
    entityType: 'push-subscription',
    entityId: deviceId || fcmToken || 'bulk',
    metadata: {
      deviceId,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    }
  });
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
  await activityService.logActivity({
    req,
    branchId: req.branchId,
    title: 'Push subscription toggled',
    type: 'Push Subscription',
    action: 'push.toggle',
    description: `${req.user?.name || 'User'} ${enabled ? 'enabled' : 'disabled'} push subscription ${deviceId}.`,
    performedBy: req.user?._id,
    entityType: 'push-subscription',
    entityId: doc._id,
    metadata: {
      deviceId,
      enabled: doc.enabled
    }
  });
  return res.json({ enabled: doc.enabled });
};

const status = async (req, res) => {
  const deviceId = req.query.deviceId || req.body?.deviceId;
  if (!deviceId) {
    return res.status(400).json({ message: 'deviceId required' });
  }
  const doc = await PushSubscription.findOne({ userId: req.user._id, deviceId, provider: 'fcm' });
  if (!doc) return res.json({ exists: false, enabled: false });
  return res.json({ exists: true, enabled: doc.enabled, fcmToken: doc.fcmToken });
};

const testPush = async (req, res) => {
  if (!pushService.isConfigured()) {
    return res.status(503).json({ message: 'Push not configured' });
  }
  const { title, body } = req.body || {};
  const enabledSubs = await PushSubscription.find({ userId: req.user._id, enabled: true, provider: 'fcm' });
  if (!enabledSubs.length) {
    return res.status(404).json({ message: 'No enabled subscriptions for this device' });
  }
  const result = await pushService.sendPushToUser({
    userId: req.user._id,
    title: title || 'Test Notification',
    body: body || 'This is a test push from MeroRestro',
    data: { url: '/' }
  });
  await activityService.logActivity({
    req,
    branchId: req.branchId,
    title: 'Test push sent',
    type: 'Push Notification',
    action: 'push.test',
    description: `${req.user?.name || 'User'} triggered a test push notification.`,
    performedBy: req.user?._id,
    entityType: 'push-subscription',
    entityId: req.user?._id,
    metadata: {
      subscriptions: enabledSubs.length,
      attempted: result?.attempted || enabledSubs.length,
      successCount: result?.successCount || 0,
      failureCount: result?.failureCount || 0,
      failureCodes: result?.failureCodes || []
    }
  });
  return res.json({
    message: 'Push sent',
    count: enabledSubs.length,
    delivery: result || { attempted: enabledSubs.length, successCount: 0, failureCount: enabledSubs.length }
  });
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
