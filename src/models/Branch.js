const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, unique: true, sparse: true },
    address: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    settings: {
      currency: { type: String, default: 'NPR' },
      taxRate: { type: Number, default: 0 }
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
