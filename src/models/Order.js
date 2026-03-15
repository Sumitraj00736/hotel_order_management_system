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
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'served', 'paid'],
      default: 'pending'
    },
    spiceLevel: { type: String, enum: ['mild', 'medium', 'spicy', 'extra_spicy'], default: 'medium' },
    specialInstructions: { type: String, trim: true },
    kitchenAssigned: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    kitchenAssignedAt: { type: Date },
    paymentMethod: { type: String, enum: ['cash', 'fonepay'] },
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
