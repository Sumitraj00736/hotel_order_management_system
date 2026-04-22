const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    legalName: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    dob: { type: Date },

    // Opening balance: 'dr' = To Collect (they owe us), 'cr' = To Pay (we owe them)
    openingBalanceType: { type: String, enum: ['dr', 'cr'], default: 'dr' },
    openingAmount: { type: Number, min: 0, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

supplierSchema.index({ branchId: 1, name: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
