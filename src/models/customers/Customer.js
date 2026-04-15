const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    dob: { type: Date },
    loyaltyDiscount: { type: Number, default: 0 },
    openingBalanceType: { type: String, enum: ['dr', 'cr'], default: 'dr' },
    openingAmount: { type: Number, default: 0 },
    legalName: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    creditLimit: { type: Number, default: 0 },
    creditTermDays: { type: Number, default: 0 },
    address: { type: String, trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

customerSchema.index({ branchId: 1, name: 1 });
customerSchema.index({ branchId: 1, email: 1 });
customerSchema.index({ branchId: 1, phone: 1 });

module.exports = mongoose.model('Customer', customerSchema);
