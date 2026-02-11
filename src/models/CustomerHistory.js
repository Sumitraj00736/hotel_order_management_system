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
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    tableNumber: { type: Number, required: true },
    items: { type: [historyItemSchema], required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'fonepay'], required: true },
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

module.exports = mongoose.model('CustomerHistory', customerHistorySchema);
