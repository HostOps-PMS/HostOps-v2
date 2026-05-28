import mongoose from 'mongoose';

const trustedDeviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true,
  },
  deviceId: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // Automatically delete document when this date is reached
  }
}, {
  timestamps: true,
});

// A user should not have duplicate trusted devices with the same ID
trustedDeviceSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

export default mongoose.model('trustedDevice', trustedDeviceSchema);
