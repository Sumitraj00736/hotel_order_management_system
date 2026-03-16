const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
    quantity: { type: Number, required: true, min: 1 },
    priceAtOrderTime: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
    items: { type: [orderItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    subTotal: { type: Number, min: 0 },
    discountType: { type: String, enum: ['amount', 'percent'], default: 'amount' },
    discountValue: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxRate: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    tipsAmount: { type: Number, min: 0, default: 0 },
    roundOff: { type: Number, default: 0 },
    taxableAmount: { type: Number, min: 0, default: 0 },
    finalAmount: { type: Number, min: 0, default: 0 },
    tenderAmount: { type: Number, min: 0, default: 0 },
    changeDue: { type: Number, min: 0, default: 0 },
    invoiceNo: { type: String, trim: true },
    kotNo: { type: String, trim: true },
    orderType: { type: String, enum: ['dine_in', 'takeaway', 'delivery', 'online'], default: 'dine_in' },
    customerName: { type: String, trim: true },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid', 'credit'], default: 'unpaid' },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'served', 'paid'],
      default: 'pending'
    },
    spiceLevel: { type: String, enum: ['mild', 'medium', 'spicy', 'extra_spicy'], default: 'medium' },
    specialInstructions: { type: String, trim: true },
    kitchenAssigned: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kitchenAssignedAt: { type: Date },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank'] },
    paymentRemark: { type: String },
    paidAt: { type: Date },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    source: { type: String, enum: ['staff', 'guest'], default: 'staff' },
    guestName: { type: String, trim: true },
    guestSession: { type: String, trim: true },
    editLogs: [
      {
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        editedAt: { type: Date, default: Date.now },
        changes: { type: String }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
