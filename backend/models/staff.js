// src/models/staff.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema({
  // The client (user) this staff belongs to
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true,
  },

  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, default: '', trim: true },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },

  password: {
    type: String,
    required: true,
    select: false,
  },

  // Which Smoobu property IDs this staff member can access
  // These are Smoobu apartment IDs (numbers), stored as strings for safety
  propertyIds: {
    type: [String],
    default: [],
  },

  // Optional label / role descriptor (e.g. "Cleaner", "Maintenance", "Receptionist")
  staffRole: {
    type: String,
    default: '',
    trim: true,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  mustChangePassword: {
    type: Boolean,
    default: true,
  },

  lastLoginAt: { type: Date },

  // ── OTP for password-change verification ─────────────────────────
  // Used by POST /auth/send-change-password-otp and
  // POST /auth/verify-reset-token (staff path).
  // Stored hashed; cleared after successful verification.
  loginOtp:       { type: String, select: false },
  loginOtpExpiry: { type: Date,   select: false },
}, {
  timestamps: true,
});

// ── Hash password before save ─────────────────────────────────────
staffSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare password ──────────────────────────────────────────────
staffSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Sanitize for API response ─────────────────────────────────────
staffSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

export default mongoose.model('staff', staffSchema);