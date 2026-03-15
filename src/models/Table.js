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

module.exports = mongoose.model('Table', tableSchema);
