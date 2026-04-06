const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    tableNumber: { type: Number, required: true, unique: true },
    status: { type: String, enum: ['available', 'occupied'], default: 'available' },
    row: { type: Number, min: 1 },
    column: { type: Number, min: 1 }
  },
  { timestamps: true }
);

tableSchema.index({ branchId: 1, tableNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Table', tableSchema);
