// routes/smoobuApartments.js
// ─────────────────────────────────────────────────────────────────
// GET /api/accounts/:clientId/smoobu-apartments
//
// Returns all Smoobu sub-apartments (rooms/units) for a client's
// DB-stored property (or all properties when no propertyIndex given).
//
// Query params:
//   propertyIndex  (optional) — 0-based index into client.properties[].
//                               Omit to fetch ALL properties for this client.
//
// Each property has its own smoobuApiKey stored encrypted in the DB.
// For each key we call GET /apartments (Smoobu) then GET /apartments/:id
// for the location/lat/lng of every sub-apartment.
//
// Response shape:
// {
//   allApartments: [{
//     apartmentId, apartmentName, propertyName, clientId, clientName,
//     street, zip, city, country, latitude, longitude,
//     timeZone, currency, maxOccupancy, bedrooms, bathrooms, type
//   }],
//   propertyCount: number,   // how many DB properties were queried
//   totalFound:   number,    // total sub-apartments returned by Smoobu
// }
// ─────────────────────────────────────────────────────────────────

import { Router }    from 'express';
import User          from '../models/user.js';
import { decrypt }   from '../utils/encryption.js';
import { getApartments, getApartmentDetail } from '../services/smoobu.js';

const router = Router();

// ── Helper: fetch all sub-apartments for one Smoobu API key ───────
async function fetchApartmentsForKey(propertyCtx, propertyName, clientId, clientName) {
  const { apartments } = await getApartments(propertyCtx);

  const results = await Promise.all(
    apartments.map(async (apt) => {
      const aptId = apt.id ?? apt;
      try {
        const detail = await getApartmentDetail(propertyCtx, aptId);
        const loc = detail?.location || {};
        const lat = parseFloat(loc.latitude);
        const lng = parseFloat(loc.longitude);
        return {
          apartmentId:   aptId,
          apartmentName: apt.name || detail?.name || `Apartment ${aptId}`,
          propertyName,
          clientId,
          clientName,
          street:    loc.street  || '',
          zip:       loc.zip     || '',
          city:      loc.city    || '',
          country:   loc.country || '',
          latitude:  Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
          timeZone:     detail?.timeZone || null,
          currency:     detail?.currency || null,
          maxOccupancy: detail?.rooms?.maxOccupancy ?? null,
          bedrooms:     detail?.rooms?.bedrooms ?? null,
          bathrooms:    detail?.rooms?.bathrooms ?? null,
          type:         detail?.type?.name || null,
        };
      } catch (detailErr) {
        // Detail failed — return stub so counts stay consistent
        console.warn(`[smoobuApartments] detail fetch failed for apt ${aptId}:`, detailErr.message);
        return {
          apartmentId:   aptId,
          apartmentName: apt.name || `Apartment ${aptId}`,
          propertyName,
          clientId,
          clientName,
          street: '', zip: '', city: '', country: '',
          latitude: null, longitude: null,
          timeZone: null, currency: null,
          maxOccupancy: null, bedrooms: null, bathrooms: null, type: null,
        };
      }
    })
  );

  return results;
}

// ── Route ─────────────────────────────────────────────────────────
router.get('/:clientId/smoobu-apartments', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { propertyIndex } = req.query; // optional

    // Only admin/team_leader may call this endpoint
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'team_leader')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Load the client (include properties with smoobuApiKey via lean)
    const client = await User.findById(clientId)
      .select('businessName firstName lastName email properties')
      .lean();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientName = client.businessName ||
      [client.firstName, client.lastName].filter(Boolean).join(' ') ||
      client.email;

    const allProps = Array.isArray(client.properties) ? client.properties : [];

    // Determine which properties to query
    let propsToQuery = [];
    if (propertyIndex !== undefined && propertyIndex !== null && propertyIndex !== '') {
      const idx = parseInt(propertyIndex, 10);
      if (isNaN(idx) || idx < 0 || idx >= allProps.length) {
        return res.status(400).json({ error: `propertyIndex ${propertyIndex} is out of range (0–${allProps.length - 1})` });
      }
      propsToQuery = [{ prop: allProps[idx], propName: allProps[idx].propertyName || `Property ${idx + 1}` }];
    } else {
      // All properties for this client
      propsToQuery = allProps.map((prop, i) => ({
        prop,
        propName: prop.propertyName || `Property ${i + 1}`,
      }));
    }

    // For each property, decrypt the key and fetch sub-apartments
    const allApartments = [];

    await Promise.all(
      propsToQuery.map(async ({ prop, propName }) => {
        if (!prop.smoobuApiKey || !prop.smoobuApiKey.trim()) {
          console.warn(`[smoobuApartments] property "${propName}" of client ${clientId} has no API key — skipping`);
          return;
        }

        let decryptedKey = '';
        try {
          decryptedKey = decrypt(prop.smoobuApiKey) || '';
        } catch (e) {
          console.warn(`[smoobuApartments] decrypt failed for property "${propName}":`, e.message);
          return;
        }

        if (!decryptedKey || !decryptedKey.trim()) {
          console.warn(`[smoobuApartments] empty key after decrypt for property "${propName}" — skipping`);
          return;
        }

        const propertyCtx = {
          _id:          String(prop._id),
          smoobuApiKey: decryptedKey.trim(),
        };

        try {
          const apts = await fetchApartmentsForKey(propertyCtx, propName, String(clientId), clientName);
          allApartments.push(...apts);
        } catch (fetchErr) {
          console.warn(`[smoobuApartments] Smoobu fetch failed for property "${propName}":`, fetchErr.message);
          // Push a stub so the frontend still shows this property in the legend
          allApartments.push({
            apartmentId:   `stub:${String(prop._id)}`,
            apartmentName: propName,
            propertyName:  propName,
            clientId:      String(clientId),
            clientName,
            street: '', zip: '', city: '', country: '',
            latitude: null, longitude: null,
            timeZone: null, currency: null,
            maxOccupancy: null, bedrooms: null, bathrooms: null, type: null,
            fetchError: fetchErr.message,
          });
        }
      })
    );

    console.log(`[smoobuApartments] client=${clientId} propertyIndex=${propertyIndex ?? 'all'} → ${allApartments.length} apartments`);

    return res.json({
      allApartments,
      propertyCount: propsToQuery.length,
      totalFound:    allApartments.length,
    });

  } catch (err) {
    console.error('[smoobuApartments] unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;