const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    spaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Space' },
    tableTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'TableType' },
    tableNumber: { type: Number, required: true },
    name: { type: String, trim: true },
    type: { type: String, trim: true, default: 'table' },
    capacity: { type: Number, min: 0 },
    charge: { type: Number, min: 0 },
    status: { type: String, enum: ['available', 'occupied'], default: 'available' },
    row: { type: Number, min: 1 },
    column: { type: Number, min: 1 },
    isTrashed: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

tableSchema.index({ branchId: 1, tableNumber: 1 }, { unique: true, sparse: true });
tableSchema.index({ branchId: 1, isTrashed: 1, tableNumber: 1 });

module.exports = mongoose.model('Table', tableSchema);
