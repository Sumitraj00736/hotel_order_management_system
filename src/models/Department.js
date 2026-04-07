const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

departmentSchema.index({ branchId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', departmentSchema);
