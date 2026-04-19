const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }
  },
  { _id: false }
);

// Generic payment entry used for Payment In / Payment Out screens and Daybook.
// This is intentionally simple and can represent:
// - customer payment collection (in)
// - supplier payment (out)
// - internal transfers (future)
const paymentSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

    direction: { type: String, enum: ['in', 'out'], required: true },
    amount: { type: Number, required: true, min: 0 },

    /** normal: Payment In/Out; balance_transfer_*: maps to Day Book Balance T/F rows */
    entryType: {
      type: String,
      enum: ['normal', 'balance_transfer_in', 'balance_transfer_out'],
      default: 'normal'
    },

    // Optional categorization / UI label.
    accountHead: { type: String, trim: true, default: '' },

    // Party selector (Customer/Staff/Supplier/Other) in UI.
    partyType: { type: String, enum: ['customer', 'staff', 'supplier', 'other'], default: 'other' },
    partyId: { type: mongoose.Schema.Types.ObjectId },
    partyName: { type: String, trim: true, default: '' },

    // Payment block (Paid vs Unpaid/Credit) for consistency across finance screens.
    paymentStatus: { type: String, enum: ['paid', 'unpaid_credit'], default: 'paid' },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank', 'owner'], default: 'cash' },
    multiplePayment: { type: Boolean, default: false },

    referenceNo: { type: String, trim: true, default: '' },
    txnDate: { type: Date, default: Date.now },
    remarks: { type: String, trim: true, default: '' },
    attachments: { type: [attachmentSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

paymentSchema.index({ branchId: 1, txnDate: -1 });
paymentSchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

