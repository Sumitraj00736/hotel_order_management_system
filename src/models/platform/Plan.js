const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    price: { type: Number, required: true, min: 0 },
    billing_cycle: { type: String, enum: ['monthly', 'yearly', 'lifetime'], required: true },
    description: { type: String, maxlength: 1000 },
    features: { type: Map, of: Boolean, default: {} },
    trial_days: { type: Number, default: 0, min: 0 },
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformAdmin' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
