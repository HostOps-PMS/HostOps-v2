// src/models/staff.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const staffSchema = new mongoose.Schema({
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

  propertyIds: {
    type: [String],
    default: [],
  },

  staffRole: {
    type: String,
    default: 'staff',
    trim: true,
  },

  isActive: {
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

  // ── PIN lockout tracking ──────────────────────────────────────────
  //
  // pinAttempts:          cumulative wrong-PIN count. Escalation: 3→1min, 4→3min, 5→1hr, 6→1day, 7→permanent.
  //                       Auto-resets to 0 if 48 hrs pass with no wrong attempt. Permanent lock is never auto-cleared.
  // lastPinFailAt:        timestamp of the most recent wrong attempt (drives the 48-hr restore window).
  // pinLockedUntil:       time until which PIN entry is blocked (null = not locked)
  // pinPermanentlyLocked: true when attempts reach the final threshold —
  //                       only an admin can clear this via POST /api/accounts/unlock
  pinAttempts:          { type: Number,   default: 0 },
  lastPinFailAt:        { type: Date,     default: null, select: false },
  pinLockedUntil:       { type: Date,     default: null },
  pinPermanentlyLocked: { type: Boolean,  default: false },

  lastLoginAt: { type: Date },

  // ── OTP for password-change verification ─────────────────────────
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
  delete obj.lastPinFailAt;
  delete obj.__v;
  return obj;
};

export default mongoose.model('staff', staffSchema);