// src/models/property.js
// ─────────────────────────────────────────────────────────────────
// A Property belongs to a business account (User with role 'client').
// It holds the Smoobu API key used to fetch its rooms/units, which
// are stored as subProperties (fetched and cached from Smoobu).
//
// Structure:
//   Business Account (User)
//     └── Property (this model)
//           ├── smoobuApiKey  ← used to call Smoobu API
//           └── subProperties[]  ← rooms/units fetched from Smoobu
// ─────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';

// ── Sub-property schema (rooms / units under a property) ──────────
// These are populated by syncing with the Smoobu API.
// Stored here so the admin dashboard can display them without an
// extra Smoobu round-trip on every page load.
const subPropertySchema = new mongoose.Schema({
  // Smoobu apartment/room ID
  smoobuId: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    default: '',
    trim: true,
  },
  // Raw Smoobu apartment object — stored for reference/display
  smoobuData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
    select: false, // exclude from default queries; load explicitly when needed
  },
  lastSyncedAt: {
    type: Date,
    default: null,
  },
}, { _id: true });

// ── Property schema ───────────────────────────────────────────────
const propertySchema = new mongoose.Schema({
  // The business account this property belongs to
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
    index: true,
  },

  // Display name for this property (e.g. "Sunset Villas", "Beach House Portfolio")
  name: {
    type: String,
    required: true,
    trim: true,
  },

  // Optional description / notes
  description: {
    type: String,
    default: '',
    trim: true,
  },

  // The property picture URL (cropped)
  propertyPicture: {
    type: String,
    default: '',
  },

  // The original full-resolution picture URL
  propertyPictureOriginal: {
    type: String,
    default: '',
  },

  // Crop configuration data { crop: { x, y }, zoom, croppedAreaPixels }
  propertyPictureCropData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },

  // The Smoobu API key for THIS property.
  // select: false — must be explicitly requested; never returned by default.
  smoobuApiKey: {
    type: String,
    select: false,
    default: null,
  },

  // Set when a valid smoobuApiKey is saved/updated
  smoobuConnectedAt: {
    type: Date,
    default: null,
  },

  // Rooms / units under this property, fetched from Smoobu
  // and cached here. Call the sync endpoint to refresh.
  subProperties: {
    type: [subPropertySchema],
    default: [],
  },

  // When subProperties were last synced from Smoobu
  lastSyncedAt: {
    type: Date,
    default: null,
  },

  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// ── Compound index: one owner can have many properties ────────────
propertySchema.index({ ownerId: 1, name: 1 });

// ── Sanitize for API response ─────────────────────────────────────
// smoobuApiKey is select:false so it won't appear in normal queries,
// but toJSON strips it as an extra safety net.
propertySchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.smoobuApiKey;
  delete obj.__v;
  // Strip raw smoobu data from each subProperty to keep responses lean
  if (obj.subProperties) {
    obj.subProperties = obj.subProperties.map(({ smoobuData, ...rest }) => rest);
  }
  return obj;
};

export default mongoose.model('property', propertySchema);
