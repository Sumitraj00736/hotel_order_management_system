const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }
  },
  { _id: false }
);

const incomeSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    amount: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true },

    // Used for UI filters + reports ("Account Head" dropdown in screenshot).
    accountHead: { type: String, trim: true, default: '' },

    // Party selection (Customer/Staff/Supplier) in the UI.
    partyType: { type: String, enum: ['customer', 'staff', 'supplier', 'other'], default: 'other' },
    partyId: { type: mongoose.Schema.Types.ObjectId },
    partyName: { type: String, trim: true, default: '' },

    // Payment block (Paid vs Unpaid/Credit).
    paymentStatus: { type: String, enum: ['paid', 'unpaid_credit'], default: 'paid' },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank', 'owner'], default: 'cash' },
    multiplePayment: { type: Boolean, default: false },

    referenceNo: { type: String, trim: true, default: '' },
    txnDate: { type: Date, default: Date.now },

    attachments: { type: [attachmentSchema], default: [] },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

incomeSchema.index({ branchId: 1, txnDate: -1 });
incomeSchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model('Income', incomeSchema);

