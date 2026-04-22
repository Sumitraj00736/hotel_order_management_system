const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    ingredient: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
    delta: { type: Number, required: true }, // positive for restock, negative for consumption
    reason: { type: String, enum: ['order', 'restock', 'adjustment'], required: true },
    referenceOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    referencePurchase: { type: mongoose.Schema.Types.ObjectId, ref: 'Purchase' },
    unitCost: { type: Number, min: 0 },
    totalCost: { type: Number, min: 0 },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

stockTransactionSchema.index({ branchId: 1, createdAt: -1 });
stockTransactionSchema.index({ ingredient: 1, createdAt: -1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
