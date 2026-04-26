const mongoose = require('mongoose');
const MathUtils = require('../../utils/mathUtils');

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true },
    publicId: { type: String, trim: true }
  },
  { _id: false }
);

const purchaseItemSchema = new mongoose.Schema(
  {
    // Backward-compat fields
    name: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    unitPrice: { type: Number, min: 0 },
    total: { type: Number, min: 0 },

    // Screenshot-aligned fields (optional for existing data)
    stockItemId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, trim: true, default: '' },
    uom: { type: String, trim: true, default: '' },
    qty: { type: Number, min: 0 },
    rate: { type: Number, min: 0 },
    amount: { type: Number, min: 0 },
    accountHead: { type: String, trim: true, default: '' }
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName: { type: String, trim: true },
    referenceNo: { type: String, trim: true },
    title: { type: String, trim: true },

    // Purchase Bill fields (align with UI screenshots)
    billDate: { type: Date },
    billReferenceNumber: { type: String, trim: true },
    purchaseStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Computed total amount for the purchase bill.
    amount: { type: Number, required: true, min: 0 },
    subTotal: { type: Number, default: 0, min: 0 },
    discountType: { type: String, enum: ['amount', 'percent'], default: 'amount' },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, default: 0, min: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, default: 0, min: 0 },

    paymentStatus: { type: String, enum: ['paid', 'unpaid_credit'], default: 'paid' },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank', 'owner'], default: 'cash' },
    multiplePayment: { type: Boolean, default: false },

    paidAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    items: { type: [purchaseItemSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, trim: true },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

purchaseSchema.index({ branchId: 1, paidAt: -1 });
purchaseSchema.index({ branchId: 1, createdAt: -1 });
purchaseSchema.index({ branchId: 1, status: 1, paidAt: -1 });

purchaseSchema.pre('save', function (next) {
  [
    'amount',
    'subTotal',
    'discountValue',
    'discountAmount',
    'taxRate',
    'taxAmount',
    'taxableAmount',
    'roundOff',
    'grandTotal',
    'amountPaid',
    'amountDue'
  ].forEach((field) => {
    if (this[field] !== undefined) {
      this[field] = MathUtils.roundAmount(this[field]);
    }
  });
  next();
});

module.exports = mongoose.model('Purchase', purchaseSchema);
