// src/models/apartmentPhoto.js
// ─────────────────────────────────────────────────────────────────
// Self-hosted photos for a Smoobu apartment (room/unit).
//
// WHY THIS EXISTS:
//   Smoobu's REST API has NO image endpoint, and the public apartment
//   page (login.smoobu.com/.../website-external/apartment/{id}) redirects
//   to a login wall — so there is no way to read photos FROM Smoobu.
//   Instead, admins upload photos here and we host them on Cloudinary.
//
// Keyed by `apartmentId` (the numeric Smoobu apartment id, stored as a
// string) so the dashboard overview + smoobu-apartments route can attach
// the right photos to each room regardless of which DB property it maps to.
// ─────────────────────────────────────────────────────────────────
import mongoose from 'mongoose';

const apartmentImageSchema = new mongoose.Schema({
  url:      { type: String, required: true },
  publicId: { type: String, default: '' }, // Cloudinary public_id (for deletes)
}, { _id: false });

const apartmentPhotoSchema = new mongoose.Schema({
  // Smoobu apartment id (kept as String for consistent matching everywhere)
  apartmentId: { type: String, required: true, unique: true, index: true },

  // Metadata (best-effort — for admin reference only)
  clientId:      { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
  clientName:    { type: String, default: '' },
  propertyName:  { type: String, default: '' },
  apartmentName: { type: String, default: '' },

  // Ordered list — first image is the cover/primary.
  images: { type: [apartmentImageSchema], default: [] },
}, {
  timestamps: true,
});

export default mongoose.model('apartmentPhoto', apartmentPhotoSchema);
