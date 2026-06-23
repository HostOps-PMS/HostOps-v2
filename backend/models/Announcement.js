import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },

    image: {
      url:      { type: String, default: '' },
      publicId: { type: String, default: '' },
    },

    audience: {
      type: String,
      enum: ['all', 'selected'],
      default: 'all',
      index: true,
    },

    targetClients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
    }],

    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },

    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },

    startDate: { type: Date, default: null },
    endDate:   { type: Date, default: null },

    publishedAt: { type: Date, default: null },

    createdBy: {
      userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
      email:     { type: String, default: '' },
      firstName: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Announcement', announcementSchema);
