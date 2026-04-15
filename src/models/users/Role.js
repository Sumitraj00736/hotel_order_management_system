const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    name: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true },
    color: { type: String, trim: true, default: '#ef4444' },
    permissions: { type: [String], default: [] },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

roleSchema.index({ branchId: 1, name: 1 }, { unique: true });

roleSchema.pre('save', function normalizeName(next) {
  if (this.name) this.name = this.name.toLowerCase().trim();
  next();
});

module.exports = mongoose.model('Role', roleSchema);
