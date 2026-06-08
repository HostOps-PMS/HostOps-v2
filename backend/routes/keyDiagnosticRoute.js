// src/routes/keyDiagnosticRoute.js
// ─────────────────────────────────────────────────────────────────
// ⚠️ TEMPORARY DIAGNOSTIC — TANGGALIN PAGKATAPOS GAMITIN.
//
// Mount sa server.js (pansamantala):
//   import keyDiagnosticRoute from './routes/keyDiagnosticRoute.js';
//   app.use('/api', keyDiagnosticRoute);
//
// Tapos bisitahin (naka-login bilang admin):
//   GET /api/_key-diagnostic
//
// Ipapakita nito ang fingerprint ng FIELD_ENCRYPTION_KEY na nakikita ng
// environment na ito (Render), PLUS kung ilang stored key ang nade-decrypt.
// I-compare ang keyFingerprint sa local mo (b3aa0d9a9d02ff00).
//
// Hindi nito ibinubunyag ang totoong key — fingerprint (sha256) lang.
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import crypto from 'crypto';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import User from '../models/user.js';
import { isEncrypted, decrypt } from '../utils/encryption.js';

const router = express.Router();

router.get('/_key-diagnostic', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const raw = process.env.FIELD_ENCRYPTION_KEY || '';
    const trimmed = raw.trim();
    const fingerprint = trimmed
      ? crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 16)
      : null;

    // Test decryption against stored keys
    const users = await User.find({ 'properties.0': { $exists: true } })
      .select('businessName properties')
      .lean();

    let total = 0, plaintext = 0, decrypted = 0, failed = 0;
    const perBusiness = [];

    for (const u of users) {
      for (const p of u.properties || []) {
        const v = p.smoobuApiKey;
        if (!v || !String(v).trim()) continue;
        total++;
        if (!isEncrypted(String(v))) {
          plaintext++;
          perBusiness.push({ business: u.businessName, status: 'plaintext' });
        } else {
          const out = decrypt(String(v));
          if (out && out !== '') {
            decrypted++;
            perBusiness.push({ business: u.businessName, status: 'decrypted-ok', last4: out.slice(-4) });
          } else {
            failed++;
            perBusiness.push({ business: u.businessName, status: 'decrypt-FAILED' });
          }
        }
      }
    }

    res.json({
      note: 'TEMPORARY DIAGNOSTIC — remove this route after use.',
      environment: {
        keyPresent:     !!raw,
        rawLength:      raw.length,
        trimmedLength:  trimmed.length,
        hasWhitespace:  raw !== trimmed,
        hasQuotes:      /["']/.test(raw),
        isValidHex:     /^[0-9a-fA-F]+$/.test(trimmed),
        first4:         trimmed.slice(0, 4),
        last4:          trimmed.slice(-4),
        keyFingerprint: fingerprint,
      },
      localFingerprintForComparison: 'b3aa0d9a9d02ff00',
      fingerprintsMatch: fingerprint === 'b3aa0d9a9d02ff00',
      decryptionTest: { total, plaintext, decrypted, failed },
      perBusiness,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
