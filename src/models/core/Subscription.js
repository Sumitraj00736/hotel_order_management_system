const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, unique: true },
    planName: { type: String, default: 'Free Plan' },
    tier: { type: String, default: 'free' },
    activeSince: { type: Date, default: Date.now },
    status: { type: String, default: 'active' },
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
