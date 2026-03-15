const Notification = require('../models/Notification');
const { emitNotification } = require('./socket');

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
};

module.exports = { notifyRole, notifyUser };
