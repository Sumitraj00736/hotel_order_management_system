const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    role: { type: String, lowercase: true, trim: true },
    provider: { type: String, default: 'fcm', lowercase: true, trim: true },
    platform: { type: String, default: 'web', lowercase: true, trim: true },
    deviceId: { type: String, required: true },
    fcmToken: { type: String },
    endpoint: { type: String },
    keys: {
      p256dh: { type: String },
      auth: { type: String }
    },
    userAgent: { type: String },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ userId: 1, deviceId: 1, provider: 1 }, { unique: true });
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true, sparse: true });
pushSubscriptionSchema.index({ fcmToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
