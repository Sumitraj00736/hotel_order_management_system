const mongoose = require('mongoose');

const addOnSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, unique: true, trim: true },
    type: { type: String, trim: true },
    price: { type: Number, required: true, default: 0 },
    imageUrl: { type: String },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

addOnSchema.index({ branchId: 1, name: 1 });

module.exports = mongoose.model('AddOn', addOnSchema);
