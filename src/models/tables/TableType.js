const mongoose = require('mongoose');

const tableTypeSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

tableTypeSchema.index({ branchId: 1, name: 1 }, { unique: true });
tableTypeSchema.index({ branchId: 1, active: 1, name: 1 });

module.exports = mongoose.model('TableType', tableTypeSchema);

