// src/models/RefreshToken.js
import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accessJti: {
      type: String,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL — auto-delete at expiry
    },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null }, // rotation tracking
    ipAddress: { type: String },
    userAgent: { type: String },
    deviceId: { type: String },
  },
  {
    timestamps: true,
  },
);

refreshTokenSchema.methods.isActive = function () {
  return !this.revokedAt && this.expiresAt > new Date();
};

export default mongoose.model('RefreshToken', refreshTokenSchema);