// src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Embedded property sub-schema ──────────────────────────────
// Each user can own multiple properties.
// smoobuApiKey is select:false so it is never returned by default
// in API responses — must be explicitly requested with .select('+properties.smoobuApiKey').
const propertySchema = new mongoose.Schema({
  propertyName: { type: String, required: true, trim: true },
  smoobuApiKey: { type: String, default: '', trim: true, select: false },
  propertyPicture: { type: String, default: '' },
  propertyPictureOriginal: { type: String, default: '' },
  propertyPictureCropData: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: true });

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

  // Business account display name
  businessName: { type: String, required: true, trim: true },

  // Legacy fields — kept for backward compatibility with older user documents
  // created before the businessName migration. New accounts created via
  // POST /api/clients will only have businessName. Auth routes reference
  // user.firstName via the pre-save hook so nothing breaks.
  firstName: { type: String, default: '', trim: true },
  lastName:  { type: String, default: '', trim: true },

  // Human-readable label for admin users (e.g. "Main Admin", "Support Admin")
  tag: { type: String, default: '', trim: true },

  // ── Embedded properties ───────────────────────────────────────
  // Replaces the separate Property collection.
  // Each entry has a propertyName and a smoobuApiKey (hidden by default).
  properties: { type: [propertySchema], default: [] },

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

  // Used as a filter prefix when fetching properties from Smoobu.
  propertyTagPrefix: { type: String, default: '', trim: true },

  // First-login password change flag.
  // Set to true when an admin creates the account (with a default/temporary password).
  // User must change password on first dashboard load; only then is isVerified set to true.
  mustChangePassword: { type: Boolean, default: false },

  pin: {
    type: String,
    select: false,
  },

  mustChangePin: {
    type: Boolean,
    default: false,
  },

  // ── PIN lockout tracking ──────────────────────────────────────
  // pinAttempts:         cumulative wrong-PIN count (resets on success)
  // pinLockedUntil:      time until which PIN entry is blocked (null = not locked)
  // pinPermanentlyLocked: true when attempts exceed the final threshold — account
  //                       disabled with no automatic recovery
  pinAttempts:          { type: Number, default: 0 },
  pinLockedUntil:       { type: Date,   default: null },
  pinPermanentlyLocked: { type: Boolean, default: false },

// Activity tracking
  lastLoginAt: { type: Date },

  activityLog: [{
    action:    { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    meta:      { type: mongoose.Schema.Types.Mixed, default: {} },
    performedBy: {
      userId:    { type: mongoose.Schema.Types.ObjectId, default: null },
      email:     { type: String, default: '' },
      firstName: { type: String, default: '' },
      lastName:  { type: String, default: '' },
      role:      { type: String, default: 'client' },
    },
  }],
}, {
  timestamps: true,
});

// ── Auto-populate businessName for legacy users ───────────────────
// Users created before the businessName migration only have firstName/lastName.
// On any save(), derive businessName from firstName so validation passes.
userSchema.pre('save', function(next) {
  if (!this.businessName && this.firstName) {
    this.businessName = [this.firstName, this.lastName].filter(Boolean).join(' ').trim() || this.firstName;
  }
  next();
});

// ── Hash password and pin before save ─────────────────────────────────
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isModified('pin')) {
    this.pin = await bcrypt.hash(this.pin, 12);
  }
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
  delete obj.__v;
  // Strip smoobuApiKey from every embedded property before sending to client
  if (Array.isArray(obj.properties)) {
    obj.properties = obj.properties.map(({ smoobuApiKey, ...rest }) => rest);
  }
  return obj;
};

export default mongoose.model('user', userSchema);