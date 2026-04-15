const mongoose = require('mongoose');

const userBranchRoleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    orgId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    role: { type: String, required: true, lowercase: true, trim: true },
    permissions: [{ type: String }],
    isOwner: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'active' },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userBranchRoleSchema.index({ userId: 1, branchId: 1 }, { unique: true });

userBranchRoleSchema.pre('save', function normalizeRole(next) {
  if (this.role) this.role = this.role.toLowerCase().trim();
  next();
});

module.exports = mongoose.model('UserBranchRole', userBranchRoleSchema);
