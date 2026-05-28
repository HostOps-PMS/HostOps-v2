// src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
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
  firstName: { type: String, required: true, trim: true },
  lastName:  { type: String, default: '', trim: true },

  // Human-readable label for admin users (e.g. "Main Admin", "Support Admin")
  tag: { type: String, default: '', trim: true },

  // Email verification
  isVerified:        { type: Boolean, default: false },
  verifyToken:       { type: String, select: false },
  verifyTokenExpiry: { type: Date,   select: false },

  // Password reset
  resetToken:       { type: String, select: false },
  resetTokenExpiry: { type: Date,   select: false },

  // Login OTP (Device verification)
  loginOtp:       { type: String, select: false },
  loginOtpExpiry: { type: Date,   select: false },

  // Roles
  role: {
    type: String,
    enum: ['client', 'admin', 'team_leader'],
    default: 'client',
  },

  // Assigned Server for Team Leaders (points to a client User ID)
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    default: null,
  },

  // ── MULTI-TENANT READY ────────────────────────────────────────
  propertyTagPrefix: { type: String, default: '', trim: true },

  // For future multi-Smoobu — encrypted bago i-store
  smoobuApiKey:      { type: String, select: false, default: null },
  smoobuConnectedAt: { type: Date,   default: null },

  // First-login password change flag.
  // Set to true when an admin creates the account (with a default/temporary password).
  // User must change password on first dashboard load; only then is isVerified set to true.
  mustChangePassword: { type: Boolean, default: false },

  // Activity tracking
  lastLoginAt: { type: Date },
}, {
  timestamps: true,
});

// ── Hash password before save ─────────────────────────────────
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare password ──────────────────────────────────────────
userSchema.methods.comparePassword = async function(plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Sanitize for API response ─────────────────────────────────
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verifyToken;
  delete obj.verifyTokenExpiry;
  delete obj.resetToken;
  delete obj.resetTokenExpiry;
  delete obj.smoobuApiKey;
  delete obj.__v;
  return obj;
};

export default mongoose.model('user', userSchema);