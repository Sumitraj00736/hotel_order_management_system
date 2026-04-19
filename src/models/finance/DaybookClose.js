const mongoose = require('mongoose');

const moneyBucketsSchema = new mongoose.Schema(
  {
    bank: { type: Number, default: 0 },
    counter: { type: Number, default: 0 },
    owner: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    creditDue: { type: Number, default: 0 }
  },
  { _id: false }
);

const daybookSummarySchema = new mongoose.Schema(
  {
    netSales: { type: moneyBucketsSchema, default: () => ({}) },
    purchaseReturn: { type: moneyBucketsSchema, default: () => ({}) },
    paymentIn: { type: moneyBucketsSchema, default: () => ({}) },
    income: { type: moneyBucketsSchema, default: () => ({}) },
    balanceTransferIn: { type: moneyBucketsSchema, default: () => ({}) },

    purchase: { type: moneyBucketsSchema, default: () => ({}) },
    salesReturn: { type: moneyBucketsSchema, default: () => ({}) },
    paymentOut: { type: moneyBucketsSchema, default: () => ({}) },
    expenses: { type: moneyBucketsSchema, default: () => ({}) },
    balanceTransferOut: { type: moneyBucketsSchema, default: () => ({}) }
  },
  { _id: false }
);

const daybookCloseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },

    // Represents the business date being closed (normalized to start-of-day).
    day: { type: Date, required: true, index: true },

    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date, default: Date.now },
    remarks: { type: String, trim: true, default: '' },

    openingBalance: { type: Number, default: 0 },
    closingBalance: { type: Number, default: 0 },

    /** Per-column opening/closing (Bank, Counter, Owner, Credit due) — source of truth for next day. */
    openingBalanceBuckets: { type: moneyBucketsSchema, default: () => ({}) },
    closingBalanceBuckets: { type: moneyBucketsSchema, default: () => ({}) },

    // Snapshot of computed buckets at close time.
    summary: { type: daybookSummarySchema, default: () => ({}) }
  },
  { timestamps: true }
);

daybookCloseSchema.index({ branchId: 1, day: 1 }, { unique: true });
daybookCloseSchema.index({ branchId: 1, closedAt: -1 });

module.exports = mongoose.model('DaybookClose', daybookCloseSchema);

