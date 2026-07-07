// src/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { encrypt, decrypt } from '../utils/encryption.js';

// ── Embedded property sub-schema ──────────────────────────────────
const propertySchema = new mongoose.Schema({
  propertyName: { type: String, required: true, trim: true },
  // NOTE: `select: false` was removed here. When this field lives inside a
  // document-array sub-schema, doing `.select('+properties.smoobuApiKey')` makes
  // Mongoose try to reconcile a full-array projection with a single nested-path
  // projection in the same query tree, which throws:
  //   "Path collision at properties.smoobuApiKey remaining portion smoobuApiKey"
  // The field is still kept out of every API response by the toJSON() sanitizer
  // below (it strips smoobuApiKey from each property), so it is never leaked.
  smoobuApiKey: {
    type: String,
    default: '',
    trim: true,
    set: (val) => val ? encrypt(val) : val,
    get: (val) => val ? decrypt(val) : val,
  },
  smoobuApiSecret: {
    type: String,
    default: '',
    trim: true,
    set: (val) => val ? encrypt(val) : val,
    get: (val) => val ? decrypt(val) : val,
  },
  propertyPicture:         { type: String, default: '' },
  propertyPictureOriginal: { type: String, default: '' },
  propertyPictureCropData: { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: true, toJSON: { getters: true }, toObject: { getters: true } });

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

  businessName: { type: String, required: true, trim: true },

  // Legacy fields — kept for backward compatibility
  firstName: { type: String, default: '', trim: true },
  lastName:  { type: String, default: '', trim: true },

  tag: { type: String, default: '', trim: true },

  properties: { type: [propertySchema], default: [] },

  // Email verification
  isVerified:        { type: Boolean, default: false },
  verifyToken:       { type: String, select: false },
  verifyTokenExpiry: { type: Date,   select: false },
  verifyAttempts:    { type: Number, default: 0 },
  verifyLockedUntil: { type: Date,   default: null },

  // Password reset
  resetToken:       { type: String, select: false },
  resetTokenExpiry: { type: Date,   select: false },

  // Login OTP (Device verification)
  loginOtp:       { type: String, select: false },
  loginOtpExpiry: { type: Date,   select: false },

  role: {
    type: String,
    enum: ['client', 'admin', 'team_leader'],
    default: 'client',
  },

  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    default: null,
  },

  propertyTagPrefix: { type: String, default: '', trim: true },

  mustChangePassword: { type: Boolean, default: false },

  pin: {
    type: String,
    select: false,
  },

  mustChangePin: {
    type: Boolean,
    default: false,
  },

  // ── PIN lockout tracking ──────────────────────────────────────────
  //
  // pinAttempts:          cumulative wrong-PIN count. Escalation: 3→1min, 4→3min, 5→1hr, 6→1day, 7→permanent.
  //                       Auto-resets to 0 if 48 hrs pass with no wrong attempt. Permanent lock is never auto-cleared.
  // lastPinFailAt:        timestamp of the most recent wrong attempt (drives the 48-hr restore window).
  // pinLockedUntil:       time until which PIN entry is blocked (null = not locked)
  // pinPermanentlyLocked: true when attempts reach the final threshold —
  //                       only an admin can clear this via POST /api/accounts/unlock
  pinAttempts:          { type: Number, default: 0 },
  lastPinFailAt:        { type: Date,   default: null, select: false },
  pinLockedUntil:       { type: Date,   default: null },
  pinPermanentlyLocked: { type: Boolean, default: false },

  // ── TOTP Authenticator ────────────────────────────────────────────
totpSecret:  { type: String, default: null, select: false },
totpEnabled: { type: Boolean, default: false },
totpDevices: [{ name: { type: String, default: 'Authenticator App' }, addedAt: { type: Date, default: Date.now } }],
  backupCodes: { type: [{ hash: String, used: { type: Boolean, default: false } }], default: [], select: false },

  profileImage: { type: String, default: '' },

  isArchive: { type: Boolean, default: false },

  allowAdminRememberMe: { type: Boolean, default: true },

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
userSchema.pre('save', function(next) {
  if (!this.businessName && this.firstName) {
    this.businessName = [this.firstName, this.lastName].filter(Boolean).join(' ').trim() || this.firstName;
  }
  next();
});

// ── SECURITY: Protect role and tag at the database level ──────────
// This is the last line of defense. Even if every route-level check
// is somehow bypassed, these guards prevent privilege escalation.
userSchema.pre('save', function(next) {
  // Guard 1: 'tag' can never be changed once set (protects Main Admin identity).
  // Only allow setting tag on brand-new documents (isNew).
  if (!this.isNew && this.isModified('tag')) {
    // Revert to the original value — the DB value is authoritative.
    this.tag = this.get('tag', null, { getters: false });
    // If Mongoose still thinks it's modified (edge case), unmark it.
    this.unmarkModified('tag');
  }

  // Guard 2: Only the Main Admin document (tag === 'Main Admin') can
  // have role === 'admin'. Any other document trying to set admin role
  // gets forced back to 'client'.
  if (this.role === 'admin' && this.tag !== 'Main Admin') {
    // Allow only if ADMIN_ROLE env matches (for the initial seed)
    if (!process.env.ADMIN_ROLE || this.email !== process.env.ADMIN_ROLE) {
      this.role = 'client';
    }
  }

  next();
});

// ── Hash password and pin before save ─────────────────────────────
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isModified('pin')) {
    this.pin = await bcrypt.hash(this.pin, 12);
  }
  next();
});

// ── Compare password ──────────────────────────────────────────────
userSchema.methods.comparePassword = async function(plain) {
  return bcrypt.compare(plain, this.password);
};

// ── Sanitize for API response ─────────────────────────────────────
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verifyToken;
  delete obj.verifyTokenExpiry;
  delete obj.resetToken;
  delete obj.resetTokenExpiry;
  delete obj.loginOtp;
  delete obj.loginOtpExpiry;
  delete obj.totpSecret;
  delete obj.lastPinFailAt;
  delete obj.tag;              // never expose Main Admin identity
  delete obj.__v;
  if (Array.isArray(obj.properties)) {
    obj.properties = obj.properties.map(({ smoobuApiKey, smoobuApiSecret, ...rest }) => rest);
  }
  return obj;
};

export default mongoose.model('user', userSchema);