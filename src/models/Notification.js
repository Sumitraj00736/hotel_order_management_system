const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String, enum: ['activity', 'order'], default: 'activity' },
    role: { type: String, enum: ['admin', 'superadmin', 'waiter', 'kitchen'], required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    tableNumber: { type: Number },
    staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dishId: { type: mongoose.Schema.Types.ObjectId, ref: 'Menu' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stock' },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index({ branchId: 1, role: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
