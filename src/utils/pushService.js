const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@merorestro.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

const isConfigured = () => Boolean(vapidPublicKey && vapidPrivateKey);
const getPublicKey = () => vapidPublicKey || '';

const buildPayload = ({ title, body, data }) =>
  JSON.stringify({
    title: title || 'Notification',
    body: body || '',
    data: data || {}
  });

const handleSendError = async (subscription, err) => {
  const statusCode = err?.statusCode || err?.status;
  if (statusCode === 404 || statusCode === 410) {
    await PushSubscription.updateOne({ _id: subscription._id }, { enabled: false });
  }
};

const sendToSubscriptions = async (subscriptions, payload) => {
  if (!subscriptions.length) return;
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys
          },
          payload
        );
      } catch (err) {
        await handleSendError(sub, err);
      }
    })
  );
};

const sendPushToRole = async ({ branchId, role, title, body, data }) => {
  if (!isConfigured()) return;
  const subscriptions = await PushSubscription.find({
    branchId,
    role: role?.toLowerCase(),
    enabled: true,
    provider: 'webpush'
  });
  const payload = buildPayload({ title, body, data });
  await sendToSubscriptions(subscriptions, payload);
};

const sendPushToUser = async ({ userId, title, body, data }) => {
  if (!isConfigured()) return;
  const subscriptions = await PushSubscription.find({
    userId,
    enabled: true,
    provider: 'webpush'
  });
  const payload = buildPayload({ title, body, data });
  await sendToSubscriptions(subscriptions, payload);
};

module.exports = { isConfigured, getPublicKey, sendPushToRole, sendPushToUser };
