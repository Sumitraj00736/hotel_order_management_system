const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    role: { type: String, lowercase: true, trim: true },
    provider: { type: String, default: 'webpush', lowercase: true, trim: true },
    platform: { type: String, default: 'web', lowercase: true, trim: true },
    deviceId: { type: String, required: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: { type: String },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

pushSubscriptionSchema.index({ userId: 1, deviceId: 1, provider: 1 }, { unique: true });
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
