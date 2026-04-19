const mongoose = require('mongoose');

/**
 * Ledger-style cash / bank / owner accounts for future Cash & Banks module.
 * Links conceptually to Day Book buckets (counter ≈ cash drawer).
 */
const cashBankAccountSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    kind: {
      type: String,
      enum: ['cash', 'bank', 'owner', 'wallet', 'other'],
      default: 'cash'
    },
    openingBalance: { type: Number, default: 0 },
    currency: { type: String, trim: true, default: 'NPR' },
    isActive: { type: Boolean, default: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

cashBankAccountSchema.index({ branchId: 1, kind: 1, name: 1 });

module.exports = mongoose.model('CashBankAccount', cashBankAccountSchema);
