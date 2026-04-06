const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, unique: true, trim: true },
    imageUrl: { type: String },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

categorySchema.index({ branchId: 1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);
