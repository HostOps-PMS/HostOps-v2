// src/routes/accounts.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for platform account management.
//
// Mount in server.js: app.use('/api', accountsRoutes);
//
// GET  /api/accounts
//   Returns: { users: [...], staffs: [...] }
//
// GET  /api/accounts/recovery-request?email=xxx
//   Returns the latest PENDING RecoveryRequest for the given email.
//   Only pending requests are returned — resolved/dismissed ones are
//   tied to a past lockout instance and must not appear on new lockouts.
//   Used by the Unlock modal to show the user's submitted reason AND
//   to gate whether the Unlock button is enabled (no pending = no unlock).
//
// POST /api/accounts/unlock
//   Unlocks PIN lockout for a user or staff account.
//   Body: { email, accountType: 'user'|'staff' }
//   This is the dedicated unlock endpoint — the existing PATCH /api/clients/:id
//   and PATCH /api/staffs/:id endpoints do NOT accept pin lockout fields
//   in their Zod schemas, so they silently ignore them.
//
// GET  /api/accounts/:clientId/smoobu-apartments?propertyIndex=N
//   Returns the Smoobu apartments for a specific DB property entry of a client.
//   propertyIndex (optional): index into client.properties[]. If omitted,
//   fetches apartments for ALL properties that have a smoobuApiKey, merging
//   the results. Each apartment in the result includes which propertyName
//   (DB) it came from, so the frontend can group/label them.
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z }   from 'zod';
import User            from '../models/user.js';
import Staff           from '../models/staff.js';
import RecoveryRequest from '../models/RecoveryRequest.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { decrypt } from '../utils/encryption.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

// ─────────────────────────────────────────────────────────────────
// GET /api/accounts
// Returns all users and staffs with PIN lockout info.
// Sensitive fields (password, tokens, pin hash) are excluded.
// ─────────────────────────────────────────────────────────────────
router.get('/accounts', async (req, res, next) => {
  try {
    const [users, staffs] = await Promise.all([
      User.find({})
        .select(
          '_id email businessName firstName lastName role ' +
          'pinAttempts pinLockedUntil pinPermanentlyLocked ' +
          'lastLoginAt isVerified mustChangePassword createdAt updatedAt ' +
          'properties'
        )
        .sort({ createdAt: -1 })
        .lean(),

      Staff.find({})
        .select(
          '_id email firstName lastName clientId staffRole isActive ' +
          'pinAttempts pinLockedUntil pinPermanentlyLocked ' +
          'lastLoginAt mustChangePin createdAt updatedAt'
        )
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Strip smoobuApiKey from every property — raw key must never leave the server
    const sanitizedUsers = users.map((u) => ({
      ...u,
      properties: Array.isArray(u.properties)
        ? u.properties.map(({ smoobuApiKey, ...rest }) => rest)
        : [],
    }));

    res.json({ users: sanitizedUsers, staffs });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/accounts/recovery-request?email=xxx
//
// Returns the latest PENDING RecoveryRequest for the given email.
//
// Only 'pending' requests are returned. Once a request is resolved
// or dismissed (tied to a past lockout), it must NOT appear on a
// new lockout — each lockout instance requires a fresh submission.
//
// The frontend uses { found } to decide whether to enable the
// Unlock button: no pending request = Unlock button disabled.
//
// Response:
//   { found: true,  request: { _id, email, reason, status, createdAt, ... } }
//   { found: false }
// ─────────────────────────────────────────────────────────────────
router.get('/accounts/recovery-request', async (req, res, next) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ error: 'email query param is required' });
    }

    // Only return pending requests — resolved/dismissed ones belong to
    // a previous lockout instance and must not appear on a new lockout.
    const request = await RecoveryRequest.findOne({ email, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();

    if (!request) {
      return res.json({ found: false });
    }

    return res.json({ found: true, request });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/accounts/:clientId/smoobu-apartments
//
// Fetches Smoobu apartments for one or all DB properties of a client.
//
// Query params:
//   propertyIndex  {number|string}  — 0-based index into client.properties[].
//                                     If omitted, fetches all properties that
//                                     have a smoobuApiKey set.
//
// The smoobuApiKey is read from the DB (encrypted) and decrypted server-side.
// The raw key is NEVER returned to the frontend — only the apartment list.
//
// Response:
// {
//   clientId:    string,
//   clientName:  string,
//   properties: [
//     {
//       propertyIndex:  number,
//       propertyName:   string,
//       hasKey:         boolean,
//       apartments: [
//         {
//           apartmentId:   number,
//           apartmentName: string,
//           propertyName:  string,   // DB property group this belongs to
//           clientId:      string,
//           clientName:    string,
//           street:        string,
//           zip:           string,
//           city:          string,
//           country:       string,
//           latitude:      number|null,
//           longitude:     number|null,
//           type:          string|null,
//           maxOccupancy:  number|null,
//           bedrooms:      number|null,
//           bathrooms:     number|null,
//         }
//       ]
//     }
//   ],
//   allApartments: [...] // flat merged list for convenience
// }
// ─────────────────────────────────────────────────────────────────
const SMOOBU_API_BASE = 'https://login.smoobu.com/api';

async function fetchSmoobuApartments(apiKey) {
  const res = await fetch(`${SMOOBU_API_BASE}/apartments`, {
    headers: {
      'Api-Key': apiKey,
      'Cache-Control': 'no-cache',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.detail || `Smoobu /apartments returned ${res.status}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.apartments || [];
}

async function fetchSmoobuApartmentDetail(apiKey, apartmentId) {
  try {
    const res = await fetch(`${SMOOBU_API_BASE}/apartments/${apartmentId}`, {
      headers: {
        'Api-Key': apiKey,
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

router.get('/accounts/:clientId/smoobu-apartments', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { propertyIndex } = req.query;

    // ── Load client as a full Mongoose document (not .lean()) ──────────────
    // We need the smoobuApiKey getter (which decrypts the stored value) to
    // fire reliably. With .lean({ getters: true }) the getter on a nested
    // sub-schema array is NOT guaranteed to run — Mongoose only applies
    // document-level getters when it hydrates a full model instance.
    // Using a real document (no .lean()) ensures every property's
    // smoobuApiKey getter fires before we read .smoobuApiKey below.
    const client = await User.findById(clientId)
      .select('_id email businessName firstName lastName role properties');

    if (!client) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const clientName = client.businessName || client.firstName || client.email || 'Unknown';
    // Access .properties on the Mongoose document — getters are applied here
    const properties = Array.isArray(client.properties) ? client.properties : [];

    // ── Determine which properties to fetch ────────────────────────────────
    let targets = [];
    if (propertyIndex !== undefined && propertyIndex !== '') {
      const idx = Number(propertyIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= properties.length) {
        return res.status(400).json({ error: `propertyIndex ${propertyIndex} is out of range (0–${properties.length - 1}).` });
      }
      targets = [{ prop: properties[idx], idx }];
    } else {
      // All properties that have a key
      targets = properties
        .map((prop, idx) => ({ prop, idx }))
        .filter(({ prop }) => prop.smoobuApiKey && prop.smoobuApiKey.trim());
    }

    if (targets.length === 0) {
      return res.json({
        clientId:    String(client._id),
        clientName,
        properties:  [],
        allApartments: [],
        message: 'No Smoobu API keys configured for this client.',
      });
    }

    // ── Fetch Smoobu apartments for each target property in parallel ────────
    const propertyResults = await Promise.all(
      targets.map(async ({ prop, idx }) => {
        const apiKey = prop.smoobuApiKey; // already decrypted by mongoose getter
        const propName = prop.propertyName || `Property ${idx + 1}`;

        if (!apiKey || !apiKey.trim()) {
          return {
            propertyIndex: idx,
            propertyName:  propName,
            hasKey:        false,
            apartments:    [],
            error:         'No Smoobu API key set for this property.',
          };
        }

        try {
          const rawApartments = await fetchSmoobuApartments(apiKey);

          // Fetch detail (location / lat-lng) for each apartment in parallel
          const apartments = await Promise.all(
            rawApartments.map(async (apt) => {
              const detail = await fetchSmoobuApartmentDetail(apiKey, apt.id);
              const loc = detail?.location || {};
              const lat = parseFloat(loc.latitude);
              const lng = parseFloat(loc.longitude);
              return {
                apartmentId:   apt.id,
                apartmentName: apt.name || detail?.name || `Apartment ${apt.id}`,
                propertyName:  propName,
                clientId:      String(client._id),
                clientName,
                street:    loc.street  || '',
                zip:       loc.zip     || '',
                city:      loc.city    || '',
                country:   loc.country || '',
                latitude:  Number.isFinite(lat) ? lat : null,
                longitude: Number.isFinite(lng) ? lng : null,
                type:         detail?.type?.name || null,
                maxOccupancy: detail?.rooms?.maxOccupancy ?? null,
                bedrooms:     detail?.rooms?.bedrooms     ?? null,
                bathrooms:    detail?.rooms?.bathrooms    ?? null,
              };
            })
          );

          return {
            propertyIndex: idx,
            propertyName:  propName,
            hasKey:        true,
            apartments,
          };
        } catch (err) {
          // Don't crash the whole response — return a stub so the UI can
          // show which property failed and why.
          return {
            propertyIndex: idx,
            propertyName:  propName,
            hasKey:        true,
            apartments:    [],
            error:         err.message || 'Failed to fetch from Smoobu.',
          };
        }
      })
    );

    // Flat list of ALL apartments across all fetched properties
    const allApartments = propertyResults.flatMap((r) => r.apartments || []);

    res.json({
      clientId:    String(client._id),
      clientName,
      properties:  propertyResults,
      allApartments,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/accounts/unlock
//
// Dedicated endpoint for resetting PIN lockout fields.
// The existing PATCH /api/clients/:id and PATCH /api/staffs/:id
// endpoints strip these fields via Zod schema — they are intentionally
// not editable through those general-purpose update routes.
//
// Body:
//   email        {string}  — email of the account to unlock
//   accountType  {string}  — 'user' | 'staff'
//
// Also auto-resolves any pending RecoveryRequest for this email.
// ─────────────────────────────────────────────────────────────────
const unlockSchema = z.object({
  email:       z.string().email().trim(),
  accountType: z.enum(['user', 'staff']),
});

router.post('/accounts/unlock', async (req, res, next) => {
  try {
    const data = unlockSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase();

    const unlockFields = {
      pinAttempts:          0,
      lastPinFailAt:        null,
      pinLockedUntil:       null,
      pinPermanentlyLocked: false,
    };

    let updated = false;

    if (data.accountType === 'staff') {
      const result = await Staff.findOneAndUpdate(
        { email: normalizedEmail },
        { $set: unlockFields },
        { new: true }
      );
      if (!result) {
        return res.status(404).json({ error: 'Staff account not found.' });
      }
      updated = true;
    } else {
      const result = await User.findOneAndUpdate(
        { email: normalizedEmail },
        { $set: unlockFields },
        { new: true }
      );
      if (!result) {
        return res.status(404).json({ error: 'User account not found.' });
      }
      updated = true;
    }

    // Auto-resolve any pending recovery request for this email
    if (updated) {
      await RecoveryRequest.findOneAndUpdate(
        { email: normalizedEmail, status: 'pending' },
        {
          $set: {
            status:       'resolved',
            resolvedAt:   new Date(),
            resolvedBy:   req.user._id,
            resolvedNote: 'Account unlocked by admin via Accounts page.',
          },
        }
      );
    }

    res.json({ ok: true, message: 'Account PIN lockout has been cleared.' });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

export default router;