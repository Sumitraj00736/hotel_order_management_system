const mongoose = require('mongoose');

const taxSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true, trim: true },
    rate: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Tax', taxSchema);
