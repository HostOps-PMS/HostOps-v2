import mongoose from 'mongoose';

const honeypotEventSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    sessionId: { type: String, default: '' },
    ipAddress: { type: String, default: '' },
    deviceFingerprint: { type: String, default: '' },
    activityType: { type: String, default: '' },
    severity: { type: String, default: '' },
    confidenceScore: { type: Number, default: 0 },
    classification: { type: String, default: '' },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    tags: { type: [String], default: [] },
    userAgent: { type: String, default: '' },
    decoyResponse: { type: String, default: '' }
  },
  {
    timestamps: true,
    collection: 'honeypotevents'
  }
);

// Compound index for querying events by IP or Fingerprint
honeypotEventSchema.index({ ipAddress: 1, timestamp: -1 });
honeypotEventSchema.index({ deviceFingerprint: 1, timestamp: -1 });

// TTL index — auto-delete logs older than 90 days to keep collection lean.
honeypotEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7_776_000 });

const HoneypotEvent = mongoose.model('HoneypotEvent', honeypotEventSchema);
export default HoneypotEvent;
