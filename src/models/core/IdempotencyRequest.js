const mongoose = require('mongoose');

const idempotencyRequestSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    scope: { type: String, required: true, trim: true },
    method: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
    fingerprint: { type: String, required: true, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    responseStatus: { type: Number },
    responseBody: { type: mongoose.Schema.Types.Mixed },
    resourceType: { type: String, trim: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    completedAt: { type: Date }
  },
  { timestamps: true }
);

idempotencyRequestSchema.index(
  { key: 1, scope: 1, method: 1, path: 1, branchId: 1, userId: 1 },
  { unique: true }
);

module.exports = mongoose.model('IdempotencyRequest', idempotencyRequestSchema);
