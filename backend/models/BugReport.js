import mongoose from 'mongoose';

const bugReportSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    name: {
      type: String,
      trim: true,
      default: '',
    },

    page: {
      type: String,
      trim: true,
      default: '',
    },

    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
      index: true,
    },

    category: {
      type: String,
      enum: ['ui_ux', 'api_backend', 'performance', 'security', 'data', 'other'],
      default: 'other',
      index: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    stepsToReproduce: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },

    environment: {
      browser: { type: String, default: '' },
      os:      { type: String, default: '' },
    },

    images: [{
      url:      { type: String, required: true },
      publicId: { type: String, default: '' },
    }],

    status: {
      type: String,
      enum: ['open', 'in_progress', 'sent', 'resolved', 'dismissed'],
      default: 'open',
      index: true,
    },

    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    resolvedNote: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('BugReport', bugReportSchema);
