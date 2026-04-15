const Notification = require('../../models/notifications/Notification');
const { emitNotification } = require('../realtime/socket');
const { sendPushToRole, sendPushToUser } = require('./pushService');

const notifyRole = async ({ role, message, type, category = 'activity', branchId, orderId, tableNumber, staffId, dishId, supplierId, customerId, stockItemId }) => {
  const doc = await Notification.create({ role, message, type, category, branchId, orderId, tableNumber, staffId, dishId, supplierId, customerId, stockItemId });
  emitNotification(role, {
    id: doc._id,
    message,
    type,
    category,
    branchId,
    orderId,
    tableNumber,
    staffId,
    dishId,
    supplierId,
    customerId,
    stockItemId,
    createdAt: doc.createdAt
  });
  await sendPushToRole({
    branchId,
    role,
    title: type || 'Notification',
    body: message,
    data: { orderId, tableNumber, category }
  });
};

const notifyUser = async ({ role, userId, message, type, category = 'activity', branchId, orderId, tableNumber, staffId, dishId, supplierId, customerId, stockItemId }) => {
  const doc = await Notification.create({ role, userId, message, type, category, branchId, orderId, tableNumber, staffId, dishId, supplierId, customerId, stockItemId });
  emitNotification(role, {
    id: doc._id,
    message,
    type,
    category,
    branchId,
    orderId,
    tableNumber,
    waiterId: userId,
    staffId,
    dishId,
    supplierId,
    customerId,
    stockItemId,
    createdAt: doc.createdAt
  });
  await sendPushToUser({
    userId,
    title: type || 'Notification',
    body: message,
    data: { orderId, tableNumber, category }
  });
};

module.exports = { notifyRole, notifyUser };
