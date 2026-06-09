// src/services/apartmentPhotos.js
// ─────────────────────────────────────────────────────────────────
// Read-side helper for self-hosted apartment photos.
//
// Replaces the old Smoobu public-page scrape (which always returned 0
// because that page redirects to a login wall). Photos now come from the
// ApartmentPhoto collection, populated by the upload route in
// routes/smoobuApartments.js.
//
// Returns the SAME shape the old scraper returned — [{ id, url }] — so all
// existing callers (dashboardOverview.js, smoobuApartments.js, and the
// PropertyMap carousel) keep working without any change to their consumers.
// ─────────────────────────────────────────────────────────────────
import ApartmentPhoto from '../models/apartmentPhoto.js';

/**
 * Get stored photos for a single apartment.
 * @param {string|number} apartmentId
 * @returns {Promise<Array<{ id: string|null, url: string }>>}
 */
export async function getStoredApartmentImages(apartmentId) {
  if (apartmentId === null || apartmentId === undefined || apartmentId === '') return [];
  try {
    const doc = await ApartmentPhoto.findOne({ apartmentId: String(apartmentId) }).lean();
    if (!doc || !Array.isArray(doc.images)) return [];
    return doc.images
      .filter((im) => im && im.url)
      .map((im) => ({ id: im.publicId || null, url: im.url }));
  } catch (err) {
    console.warn(`[apartmentPhotos] lookup failed apt ${apartmentId}:`, err.message);
    return [];
  }
}

/**
 * Bulk variant — one query for many apartment ids.
 * @param {Array<string|number>} apartmentIds
 * @returns {Promise<Map<string, Array<{ id: string|null, url: string }>>>}
 */
export async function getStoredApartmentImagesBulk(apartmentIds = []) {
  const out = new Map();
  const ids = [...new Set(apartmentIds.filter((x) => x !== null && x !== undefined && x !== '').map(String))];
  if (ids.length === 0) return out;
  try {
    const docs = await ApartmentPhoto.find({ apartmentId: { $in: ids } }).lean();
    docs.forEach((doc) => {
      const imgs = Array.isArray(doc.images)
        ? doc.images.filter((im) => im && im.url).map((im) => ({ id: im.publicId || null, url: im.url }))
        : [];
      out.set(String(doc.apartmentId), imgs);
    });
  } catch (err) {
    console.warn('[apartmentPhotos] bulk lookup failed:', err.message);
  }
  return out;
}
