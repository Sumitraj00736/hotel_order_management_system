const mongoose = require('mongoose');

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
    
    // final grand total that needs to be paid
    grandTotal: { type: Number, required: true, min: 0 },
    
    // track how much of the grandTotal has actually been paid
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, default: 0, min: 0 },
    
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    
    waiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waiterName: { type: String },
    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

salesInvoiceSchema.index({ branchId: 1, closedAt: -1 });
salesInvoiceSchema.index({ branchId: 1, paymentStatus: 1 });
salesInvoiceSchema.index({ customerId: 1 });

// Pre-save hook to ensure amountDue is auto-calculated correctly
salesInvoiceSchema.pre('save', function (next) {
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
