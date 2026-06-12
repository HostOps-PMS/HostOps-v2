// src/models/RecoveryRequest.js
// ─────────────────────────────────────────────────────────────────
// Stores account recovery requests submitted from the PIN modal
// when a user's account is temporarily or permanently locked.
//
// Fields:
//   email         — the email address of the locked account
//   accountType   — 'user' (client/team_leader) or 'staff'
//   reason        — free-text reason entered by the user
//   status        — 'pending' | 'resolved' | 'dismissed'
//   resolvedAt    — timestamp when admin marks it resolved/dismissed
//   resolvedBy    — admin user _id who acted on the request
//   resolvedNote  — optional admin note
// ─────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';

const recoveryRequestSchema = new mongoose.Schema(
  {
    email: {
      type:     String,
      required: true,
      lowercase: true,
      trim:     true,
      index:    true,
    },

    // 'user' covers client, team_leader, admin roles.
    // 'staff' covers Staff model accounts.
    accountType: {
      type:    String,
      enum:    ['user', 'staff'],
      default: 'user',
    },

    // Distinguishes PIN lockout recovery from disabled-account appeals.
    requestType: {
      type:    String,
      enum:    ['pin_recovery', 'account_disabled'],
      default: 'pin_recovery',
      index:   true,
    },

    // Free-text reason entered by the user explaining why they were locked out.
    reason: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 1000,
    },

    status: {
      type:    String,
      enum:    ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index:   true,
    },

    resolvedAt: {
      type:    Date,
      default: null,
    },

    resolvedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'user',
      default: null,
    },

    resolvedNote: {
      type:    String,
      default: '',
      trim:    true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

export default mongoose.model('RecoveryRequest', recoveryRequestSchema);