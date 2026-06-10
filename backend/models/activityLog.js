// src/models/activityLog.js
import mongoose from 'mongoose';

const performedBySchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staffId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    email:     { type: String, default: '' },
    firstName: { type: String, default: '' },
    lastName:  { type: String, default: '' },
    role:      { type: String, default: 'client' },
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
