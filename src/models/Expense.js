const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['cash', 'fonepay', 'card', 'bank'], default: 'cash' },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

expenseSchema.index({ branchId: 1, paidAt: -1 });
expenseSchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
