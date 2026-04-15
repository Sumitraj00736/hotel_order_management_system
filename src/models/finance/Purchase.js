const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    quantity: { type: Number, min: 0 },
    unitPrice: { type: Number, min: 0 },
    total: { type: Number, min: 0 }
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    supplierName: { type: String, trim: true },
    referenceNo: { type: String, trim: true },
    title: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank'], default: 'cash' },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    items: { type: [purchaseItemSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

purchaseSchema.index({ branchId: 1, paidAt: -1 });
purchaseSchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
