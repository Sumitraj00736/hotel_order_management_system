const mongoose = require('mongoose');

const journalLineSchema = new mongoose.Schema(
  {
    accountCode: { type: String, trim: true, default: '' },
    accountName: { type: String, trim: true, default: '' },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    memo: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

/** Double-entry journal voucher — extend when building Journal Voucher UI. */
const journalVoucherSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    voucherNo: { type: String, trim: true, index: true },
    voucherDate: { type: Date, default: Date.now, index: true },
    reference: { type: String, trim: true, default: '' },
    narration: { type: String, trim: true, default: '' },
    lines: { type: [journalLineSchema], default: [] },
    status: { type: String, enum: ['draft', 'posted', 'void'], default: 'draft' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

journalVoucherSchema.index({ branchId: 1, voucherDate: -1 });

module.exports = mongoose.model('JournalVoucher', journalVoucherSchema);
