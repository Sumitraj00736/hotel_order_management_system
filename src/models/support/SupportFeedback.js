const mongoose = require('mongoose');

const supportFeedbackSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subject: { type: String, trim: true },
    message: { type: String, trim: true, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SupportFeedback', supportFeedbackSchema);
