const mongoose = require('mongoose');

const deletedUserSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    branchName: { type: String, trim: true },
    orgName: { type: String, trim: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
    snapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      role: { type: String, trim: true },
      status: { type: String, trim: true },
      dateOfJoining: { type: Date },
      salary: { type: Number },
      shiftStart: { type: String, trim: true },
      shiftEnd: { type: String, trim: true }
    },
    membership: {
      role: { type: String, trim: true },
      permissions: [{ type: String }],
      status: { type: String, trim: true },
      active: { type: Boolean },
      isOwner: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

deletedUserSchema.index({ branchId: 1, deletedAt: -1 });

module.exports = mongoose.model('DeletedUser', deletedUserSchema);
