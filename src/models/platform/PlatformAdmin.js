const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const platformAdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    isSuperAdmin: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Hash password before saving
platformAdminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare password
platformAdminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('PlatformAdmin', platformAdminSchema);
