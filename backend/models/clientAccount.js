// src/models/clientAccount.js
// ─────────────────────────────────────────────────────────────────
// A sub-account (client role) that belongs to a parent client User.
// Think of it like a Staff account but with role: 'client' instead,
// and it logs in through the main User auth flow (not Staff).
//
// Collection name: clientaccounts
// ─────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const clientAccountSchema = new mongoose.Schema({
  // The parent client User this account belongs to
  parentClientId: {
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

  // Optional label for this sub-account (e.g. "Billing", "Operations")
  accountRole: {
    type: String,
    default: '',
    trim: true,
  },

  // Which Smoobu property IDs this sub-account can access
  // (mirrors Staff.propertyIds — same Smoobu API, scoped access)
  propertyIds: {
    type: [String],
    default: [],
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

  // ── Admin AuthModal OTP gate ──────────────────────────────────────
  // Mirrors the loginOtp fields on the User model.
  // Stored hashed; cleared after successful verification.
  loginOtp:       { type: String, select: false },
  loginOtpExpiry: { type: Date,   select: false },
}, {
  timestamps: true,
  collection: 'clientaccounts', // explicit MongoDB collection name
});

// ── Hash password before save ─────────────────────────────────────
clientAccountSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare password ──────────────────────────────────────────────
clientAccountSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Sanitize for API response ─────────────────────────────────────
clientAccountSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

export default mongoose.model('clientAccount', clientAccountSchema);