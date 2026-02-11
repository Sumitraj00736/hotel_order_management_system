const Notification = require('../models/Notification');
const { emitNotification } = require('./socket');

const notifyRole = async ({ role, message, type, orderId, tableNumber }) => {
  const doc = await Notification.create({ role, message, type, orderId, tableNumber });
  emitNotification(role, {
    id: doc._id,
    message,
    type,
    orderId,
    tableNumber,
    createdAt: doc.createdAt
  });
};

const notifyUser = async ({ role, userId, message, type, orderId, tableNumber }) => {
  const doc = await Notification.create({ role, userId, message, type, orderId, tableNumber });
  emitNotification(role, {
    id: doc._id,
    message,
    type,
    orderId,
    tableNumber,
    waiterId: userId,
    createdAt: doc.createdAt
  });
};

module.exports = { notifyRole, notifyUser };
