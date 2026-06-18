import mongoose from 'mongoose';

const inboxEmailSchema = new mongoose.Schema(
  {
    messageId:      { type: String, unique: true, sparse: true },
    conversationId: { type: String, index: true, default: '' },
    subject:        { type: String, default: '' },
    from:           { type: String, default: '' },
    fromName:       { type: String, default: '' },
    body:           { type: String, default: '' },
    bodyPreview:    { type: String, default: '' },
    receivedAt:     { type: Date,   default: Date.now, index: true },
    isRead:         { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('InboxEmail', inboxEmailSchema);
