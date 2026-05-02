const mongoose = require('mongoose');

const subscriptionHistorySchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    planName: { type: String, required: true },
    purchaseDate: { type: Date, default: Date.now },
    expiryDate: { type: Date },
    documents: { type: String, trim: true },
    remarks: { type: String, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionHistory', subscriptionHistorySchema);
