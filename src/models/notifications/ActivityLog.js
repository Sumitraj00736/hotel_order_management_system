const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, trim: true },
    action: { type: String, trim: true, index: true },
    description: { type: String, trim: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    ,
    requestId: { type: String, trim: true, index: true },
    entityType: { type: String, trim: true, index: true },
    entityId: { type: String, trim: true, index: true },
    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivityLog', activityLogSchema);
