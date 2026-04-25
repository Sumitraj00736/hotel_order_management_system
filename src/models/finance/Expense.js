const mongoose = require('mongoose');

const MathUtils = require('../../utils/mathUtils');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    remarks: { type: String, trim: true },

    accountHead: { type: String, trim: true, default: '' },
    partyType: { type: String, enum: ['supplier', 'staff', 'customer', 'other'], default: 'other' },
    partyId: { type: mongoose.Schema.Types.ObjectId },
    partyName: { type: String, trim: true, default: '' },

    paymentStatus: { type: String, enum: ['paid', 'unpaid_credit'], default: 'paid' },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank', 'owner'], default: 'cash' },
    multiplePayment: { type: Boolean, default: false },
    paidAt: { type: Date, default: Date.now },
    referenceNo: { type: String, trim: true, default: '' },
    note: { type: String, trim: true },
    attachments: { type: [attachmentSchema], default: [] },
    
    // Auditing / Voiding
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, trim: true },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

expenseSchema.index({ branchId: 1, paidAt: -1 });
expenseSchema.index({ branchId: 1, createdAt: -1 });

// Ensure strict float rounding before saving
expenseSchema.pre('save', function (next) {
  if (this.isModified('amount')) {
    this.amount = MathUtils.roundAmount(this.amount);
  }
  next();
});

module.exports = mongoose.model('Expense', expenseSchema);
