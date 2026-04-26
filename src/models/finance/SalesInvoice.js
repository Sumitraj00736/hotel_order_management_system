const mongoose = require('mongoose');
const MathUtils = require('../../utils/mathUtils');

const salesItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    priceAtOrderTime: { type: Number, required: true },
    lineTotal: { type: Number, required: true }
  },
  { _id: false }
);

const salesInvoiceSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    
    invoiceNo: { type: String, trim: true, required: true },
    tableNumber: { type: Number }, // For display convenience
    
    items: { type: [salesItemSchema], required: true },
    
    subTotal: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: ['amount', 'percent'], default: 'amount' },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    taxableAmount: { type: Number, default: 0, min: 0 },
    tipsAmount: { type: Number, default: 0, min: 0 },
    roundOff: { type: Number, default: 0 },
    
    // final grand total that needs to be paid
    grandTotal: { type: Number, required: true, min: 0 },
    
    // track how much of the grandTotal has actually been paid
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, default: 0, min: 0 },
    
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    paymentMethods: { type: [String], default: [] },
    orderType: { type: String, trim: true, default: 'dine_in' },
    customerName: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['active', 'void'], default: 'active' },
    voidReason: { type: String, trim: true },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    waiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waiterName: { type: String },
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

salesInvoiceSchema.index({ branchId: 1, closedAt: -1 });
salesInvoiceSchema.index({ branchId: 1, paymentStatus: 1 });
salesInvoiceSchema.index({ branchId: 1, status: 1, closedAt: -1 });
salesInvoiceSchema.index({ customerId: 1 });

// Pre-save hook to ensure amountDue is auto-calculated correctly
salesInvoiceSchema.pre('save', function (next) {
  [
    'subTotal',
    'discountValue',
    'discountAmount',
    'taxRate',
    'taxAmount',
    'taxableAmount',
    'tipsAmount',
    'roundOff',
    'grandTotal',
    'amountPaid',
    'amountDue'
  ].forEach((field) => {
    if (this[field] !== undefined) {
      this[field] = MathUtils.roundAmount(this[field]);
    }
  });
  this.amountDue = Math.max(0, this.grandTotal - this.amountPaid);
  
  if (this.amountPaid >= this.grandTotal) {
    this.paymentStatus = 'paid';
  } else if (this.amountPaid > 0) {
    this.paymentStatus = 'partial';
  } else {
    this.paymentStatus = 'unpaid';
  }
  next();
});

module.exports = mongoose.model('SalesInvoice', salesInvoiceSchema);
