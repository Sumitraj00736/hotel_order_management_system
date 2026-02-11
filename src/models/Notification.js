const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    type: { type: String, required: true },
    role: { type: String, enum: ['admin', 'waiter', 'kitchen'], required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    tableNumber: { type: Number },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
