const mongoose = require('mongoose');

const subMenuSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, unique: true, trim: true },
    imageUrl: { type: String },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

subMenuSchema.index({ branchId: 1, name: 1 });

module.exports = mongoose.model('SubMenu', subMenuSchema);
