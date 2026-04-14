const PushSubscription = require('../models/PushSubscription');
const { getPublicKey } = require('../utils/pushService');

const getPublicKeyController = async (req, res) => {
  return res.json({ publicKey: getPublicKey() });
};

const subscribe = async (req, res) => {
  const { subscription, deviceId, enabled = true, platform = 'web' } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ message: 'Invalid subscription payload' });
  }
  if (!deviceId) {
    return res.status(400).json({ message: 'deviceId required' });
  }

  const payload = {
    userId: req.user._id,
    branchId: req.branchId,
    role: req.branchRole || req.user?.role,
    provider: 'webpush',
    platform,
    deviceId,
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    userAgent: req.headers['user-agent'],
    enabled: Boolean(enabled)
  };

  const doc = await PushSubscription.findOneAndUpdate(
    { userId: req.user._id, deviceId, provider: 'webpush' },
    payload,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.json({ message: 'Subscribed', subscriptionId: doc._id, enabled: doc.enabled });
};

const unsubscribe = async (req, res) => {
  const { deviceId, endpoint } = req.body || {};
  if (!deviceId && !endpoint) {
    return res.status(400).json({ message: 'deviceId or endpoint required' });
  }
  await PushSubscription.updateMany(
    { userId: req.user._id, ...(deviceId ? { deviceId } : {}), ...(endpoint ? { endpoint } : {}) },
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
    { userId: req.user._id, deviceId, provider: 'webpush' },
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
  const doc = await PushSubscription.findOne({ userId: req.user._id, deviceId, provider: 'webpush' });
  if (!doc) return res.json({ exists: false, enabled: false });
  return res.json({ exists: true, enabled: doc.enabled });
};

module.exports = { subscribe, unsubscribe, toggle, status, getPublicKeyController };
