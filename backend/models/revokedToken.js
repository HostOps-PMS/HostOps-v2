// src/models/revokedToken.js
//
// Stores the jti (JWT ID) of access tokens that have been explicitly
// revoked before their natural expiry — e.g. on logout, password change,
// or tab-close beacon.
//
// Lookup in requireAuth middleware:
//   const revoked = await RevokedToken.exists({ jti: decoded.jti });
//   if (revoked) return res.status(401).json({ error: 'Token revoked' });

import mongoose from 'mongoose';

const revokedTokenSchema = new mongoose.Schema({
  // The unique JWT ID claim from the access token payload.
  jti: {
    type:     String,
    required: true,
    unique:   true,
    index:    true,
  },

  // userId / staffId — stored for audit trails and bulk revocation
  // (e.g. "revoke all tokens for user X after password change").
  userId: {
    type:  String,
    index: true,
  },

  // When this jti entry should be auto-deleted by MongoDB's TTL worker.
  // Set this to the access token's own expiry so the document is cleaned
  // up exactly when the token would have expired anyway.
  expiresAt: {
    type:     Date,
    required: true,
    index:    { expires: 0 },   // TTL index — MongoDB deletes doc at this time
  },

  // Why the token was revoked — useful for audit logs.
  reason: {
    type:    String,
    default: 'logout',  // 'logout' | 'tab_close' | 'password_change' | 'pin_change'
  },
}, {
  timestamps: true,
});

export default mongoose.model('RevokedToken', revokedTokenSchema);