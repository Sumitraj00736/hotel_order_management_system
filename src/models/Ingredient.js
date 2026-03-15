const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    name: { type: String, required: true, unique: true, trim: true },
    unit: { type: String, required: true, trim: true }, // e.g., kg, g, ml, pcs
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    initialStock: { type: Number, min: 0, default: 0 },
    reorderLevel: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, trim: true },
    lastRestockedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ingredient', ingredientSchema);
