// src/models/activityLog.js
import mongoose from 'mongoose';

// ── Who performed the action ──────────────────────────────────────
const performedBySchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    email:     { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
    role:      { type: String, default: 'client' },

    // staffRole is only filled in for staff logins (e.g. "Cleaner",
    // "Co-host"). For client/admin logins it stays an empty string.
    staffRole: { type: String, default: '' },
  },
  { _id: false }
);

// ── Owner property snapshot ───────────────────────────────────────
// A lightweight copy of the owner account's properties at the time of
// the action. The Smoobu API key is intentionally NEVER stored here —
// we only keep the id + display name.
const propertyRefSchema = new mongoose.Schema(
  {
    id:           { type: mongoose.Schema.Types.ObjectId },
    propertyName: { type: String, default: '' },
  },
  { _id: false }
);

const activityLogSchema = new mongoose.Schema(
  {
    // ── Who ───────────────────────────────────────────────────────
    // userId always points to the "owner" client account.
    // If a staff member performed the action, staffId is also set.
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    staffId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
    performedBy: { type: performedBySchema, default: () => ({}) },

    // ── Account context (always the owner/client account) ─────────
    // For a client login this is the client's own info.
    // For a staff login this is the OWNER client's info (the account
    // the staff member belongs to) — the staff's own identity lives in
    // performedBy above.
    businessName: { type: String, default: '' },
    properties:   { type: [propertyRefSchema], default: [] },

    // ── What ──────────────────────────────────────────────────────
    action:      { type: String, required: true, trim: true },
    meta:        { type: mongoose.Schema.Types.Mixed, default: {} },

    // ── Context ───────────────────────────────────────────────────
    ipAddress:   { type: String, default: '' },
    userAgent:   { type: String, default: '' },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
    collection: 'activitylogs',
  }
);

// ── Indexes ───────────────────────────────────────────────────────
// Compound index for the most common query pattern:
// "give me all logs for user X, newest first"
activityLogSchema.index({ userId: 1, createdAt: -1 });

// TTL index — auto-delete logs older than 90 days to keep collection lean.
// Change the value (in seconds) to adjust the retention window:
//   30 days  →  2_592_000
//   90 days  →  7_776_000
//   180 days → 15_552_000
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7_776_000 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;