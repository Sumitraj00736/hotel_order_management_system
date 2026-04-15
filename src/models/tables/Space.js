const mongoose = require('mongoose');

const spaceSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, trim: true, default: 'space' },
    description: { type: String, trim: true },
    capacity: { type: Number, min: 0 },
    charge: { type: Number, min: 0 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

spaceSchema.index({ branchId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Space', spaceSchema);
