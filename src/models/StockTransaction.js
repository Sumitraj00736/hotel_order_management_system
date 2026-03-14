const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    delta: { type: Number, required: true }, // positive for restock, negative for consumption
    reason: { type: String, enum: ['order', 'restock', 'adjustment'], required: true },
    referenceOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
