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

  pin: {
    type: String,
    select: false,
  },

  mustChangePin: {
    type: Boolean,
    default: true,
  },

  // ── PIN lockout tracking ──────────────────────────────────────
  // pinAttempts:         cumulative wrong-PIN count (resets on success)
  // pinLockedUntil:      time until which PIN entry is blocked (null = not locked)
  // pinPermanentlyLocked: true when attempts exceed the final threshold — account
  //                       disabled with no automatic recovery
  pinAttempts:          { type: Number, default: 0 },
  pinLockedUntil:       { type: Date,   default: null },
  pinPermanentlyLocked: { type: Boolean, default: false },

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

// ── Hash password and pin before save ──────────────────────────────
staffSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isModified('pin')) {
    this.pin = await bcrypt.hash(this.pin, 12);
  }
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