const mongoose = require('mongoose');

const historyItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    priceAtOrderTime: { type: Number, required: true }
  },
  { _id: false }
);

const customerHistorySchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    tableNumber: { type: Number, required: true },
    items: { type: [historyItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    finalAmount: { type: Number },
    discountAmount: { type: Number },
    taxAmount: { type: Number },
    invoiceNo: { type: String },
    paymentMode: { type: String },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank'], required: true },
    paidAt: { type: Date, required: true },
    waiter: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String }
    },
    kitchen: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String }
    },
    orderTakenAt: { type: Date, required: true }
  },
  { timestamps: true }
);

customerHistorySchema.index({ branchId: 1, paidAt: -1 });
customerHistorySchema.index({ branchId: 1, createdAt: -1 });
customerHistorySchema.index({ branchId: 1, 'waiter.id': 1, paidAt: -1 });
customerHistorySchema.index({ branchId: 1, 'kitchen.id': 1, paidAt: -1 });

module.exports = mongoose.model('CustomerHistory', customerHistorySchema);
