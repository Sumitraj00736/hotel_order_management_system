const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String }, // Optional for Firebase/Social users
    firebaseUid: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['superadmin','admin', 'waiter', 'kitchen'], required: true, lowercase: true },
    dateOfJoining: { type: Date },
    salary: { type: Number, min: 0 },
    shiftStart: { type: String, trim: true },
    shiftEnd: { type: String, trim: true },
    promotions: [
      {
        title: { type: String, required: true, trim: true },
        amount: { type: Number, min: 0 },
        effectiveDate: { type: Date, required: true },
        note: { type: String, trim: true }
      }
    ],
    resetPasswordToken: String,
    resetPasswordExpires: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
