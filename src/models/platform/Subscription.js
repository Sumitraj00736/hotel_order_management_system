const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, unique: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
    planName: { type: String, default: 'Free Plan' },
    tier: { type: String, default: 'free' },
    activeSince: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'trial', 'cancelled', 'expired'], default: 'active' },
    trial_ends_at: { type: Date },
    current_period_start: { type: Date, default: Date.now },
    current_period_end: { type: Date },
    expiryDate: { type: Date },
    features: {
      type: Map,
      of: Boolean,
      default: {}
    },
    maxMembers: { type: Number, default: 2 },
    maxTables: { type: Number, default: 10 },
    maxCustomers: { type: Number, default: 10 },
    maxDishes: { type: Number, default: 100 },
    maxAddOns: { type: Number, default: 5 },
    maxSpaces: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', subscriptionSchema);
