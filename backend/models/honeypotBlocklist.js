import mongoose from 'mongoose';

const honeypotBlocklistSchema = new mongoose.Schema(
  {
    bannedAt: { type: Date, default: Date.now, index: true },
    deviceFingerprint: { type: String, default: '' },
    ipAddresses: { type: [String], default: [] },
    reason: { type: String, default: '' },
    confidenceScore: { type: Number, default: 0 },
    classification: { type: String, default: '' },
    expiresAt: { type: Date, default: null } // null implies permanent block
  },
  {
    timestamps: true,
    collection: 'honeypotblocklist'
  }
);

honeypotBlocklistSchema.index({ deviceFingerprint: 1 });
honeypotBlocklistSchema.index({ ipAddresses: 1 });

const HoneypotBlocklist = mongoose.model('HoneypotBlocklist', honeypotBlocklistSchema);
export default HoneypotBlocklist;
