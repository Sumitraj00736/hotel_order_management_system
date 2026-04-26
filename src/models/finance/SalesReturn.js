const mongoose = require('mongoose');
const MathUtils = require('../../utils/mathUtils');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }
  },
  { _id: false }
);

const salesReturnItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    itemName: { type: String, trim: true, default: '' },
    returnQty: { type: Number, min: 0, default: 0 },
    rate: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 }
  },
  { _id: false }
);

// Sales Return (Credit Note)
const salesReturnSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },

    // Header fields from UI screenshot
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, trim: true, default: '' },
    billReferenceNumber: { type: String, trim: true, default: '' },
    salesStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    txnDate: { type: Date, default: Date.now },

    // Totals
    subTotal: { type: Number, min: 0, default: 0 },
    roundOffDiscount: { type: Number, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },

    paymentStatus: { type: String, enum: ['paid', 'unpaid_credit'], default: 'paid' },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank', 'owner'], default: 'cash' },
    multiplePayment: { type: Boolean, default: false },

    attachments: { type: [attachmentSchema], default: [] },
    remarks: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, trim: true },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    items: { type: [salesReturnItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

salesReturnSchema.index({ branchId: 1, txnDate: -1 });
salesReturnSchema.index({ branchId: 1, createdAt: -1 });
salesReturnSchema.index({ branchId: 1, status: 1, txnDate: -1 });

salesReturnSchema.pre('save', function (next) {
  ['subTotal', 'roundOffDiscount', 'taxableAmount', 'totalAmount', 'netAmount'].forEach((field) => {
    if (this[field] !== undefined) {
      this[field] = MathUtils.roundAmount(this[field]);
    }
  });
  next();
});

module.exports = mongoose.model('SalesReturn', salesReturnSchema);
