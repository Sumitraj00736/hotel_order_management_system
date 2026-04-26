const mongoose = require('mongoose');
const MathUtils = require('../../utils/mathUtils');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }
  },
  { _id: false }
);

const purchaseReturnItemSchema = new mongoose.Schema(
  {
    stockItemId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, trim: true, default: '' },
    uom: { type: String, trim: true, default: '' },
    qty: { type: Number, min: 0, default: 0 },
    rate: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
    accountHead: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

// Purchase Return (Debit Note)
const purchaseReturnSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

    supplierId: { type: mongoose.Schema.Types.ObjectId },
    supplierName: { type: String, trim: true, default: '' },

    billDate: { type: Date, default: Date.now },
    billReferenceNumber: { type: String, trim: true, default: '' },
    purchaseStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Totals block (kept simple; UI can compute more fields if needed)
    subTotal: { type: Number, min: 0, default: 0 },
    discount: { type: Number, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    paymentStatus: { type: String, enum: ['paid', 'unpaid_credit'], default: 'paid' },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank', 'owner'], default: 'cash' },
    multiplePayment: { type: Boolean, default: false },

    attachments: { type: [attachmentSchema], default: [] },
    remarks: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, trim: true },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    items: { type: [purchaseReturnItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

purchaseReturnSchema.index({ branchId: 1, billDate: -1 });
purchaseReturnSchema.index({ branchId: 1, createdAt: -1 });
purchaseReturnSchema.index({ branchId: 1, status: 1, billDate: -1 });

purchaseReturnSchema.pre('save', function (next) {
  ['subTotal', 'discount', 'taxableAmount', 'totalAmount'].forEach((field) => {
    if (this[field] !== undefined) {
      this[field] = MathUtils.roundAmount(this[field]);
    }
  });
  next();
});

module.exports = mongoose.model('PurchaseReturn', purchaseReturnSchema);
