const mongoose = require('mongoose');

const ingredientUnitSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, trim: true },
    symbol: { type: String, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ingredientUnitSchema.index({ branchId: 1, name: 1 }, { unique: true });

ingredientUnitSchema.pre('save', function normalizeName(next) {
  if (this.name) this.name = this.name.toLowerCase().trim();
  next();
});

module.exports = mongoose.model('IngredientUnit', ingredientUnitSchema);
