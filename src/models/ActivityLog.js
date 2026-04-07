const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, trim: true },
    description: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
