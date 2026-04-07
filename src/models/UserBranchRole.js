const mongoose = require('mongoose');

const userBranchRoleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    role: { type: String, enum: ['admin', 'waiter', 'kitchen', 'manager'], required: true },
    permissions: [{ type: String }],
    status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'active' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userBranchRoleSchema.index({ userId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('UserBranchRole', userBranchRoleSchema);
