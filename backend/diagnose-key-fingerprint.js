// diagnose-key-fingerprint.js
// ─────────────────────────────────────────────────────────────────
// READ-ONLY. Patakbuhin sa MAGKABILANG environment:
//   • Local:  node diagnose-key-fingerprint.js
//   • Render: idagdag bilang one-off / temporary start command, o
//             patakbuhin via Render Shell: node backend/diagnose-key-fingerprint.js
//
// Ikukumpara natin ang output ng dalawa. Kung magkaiba ang
// keyFingerprint, IBA ang key na nakikita ng Render kaysa local —
// kahit mukhang pareho sila sa dashboard (baka may space/newline/quote).
// ─────────────────────────────────────────────────────────────────
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import User from './models/user.js';

const raw = process.env.FIELD_ENCRYPTION_KEY;

console.log('═'.repeat(60));
console.log('ENCRYPTION KEY DIAGNOSTIC');
console.log('═'.repeat(60));

if (!raw) {
  console.log('❌ FIELD_ENCRYPTION_KEY is UNDEFINED in this environment.');
} else {
  // Show only safe metadata + a fingerprint — never the full key.
  const trimmed = raw.trim();
  console.log('present         :', true);
  console.log('raw length      :', raw.length, '(dapat 64)');
  console.log('trimmed length  :', trimmed.length);
  console.log('has whitespace  :', raw !== trimmed ? '⚠️  YES (leading/trailing space or newline!)' : 'no');
  console.log('has quotes      :', /["']/.test(raw) ? '⚠️  YES (remove quotes in .env / Render!)' : 'no');
  console.log('is valid hex    :', /^[0-9a-fA-F]+$/.test(trimmed) ? 'yes' : '⚠️  NO (non-hex chars present)');
  console.log('first 4 chars   :', trimmed.slice(0, 4));
  console.log('last 4 chars    :', trimmed.slice(-4));
  // Fingerprint: sha256 of the key → compare this string across environments.
  const fp = crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 16);
  console.log('keyFingerprint  :', fp, '  ← i-compare ito local vs Render');
}

console.log('─'.repeat(60));

// Now actually try to decrypt the stored keys with THIS environment's key.
const ALG = 'aes-256-gcm';
const KEY = raw && raw.trim().length === 64 ? Buffer.from(raw.trim(), 'hex') : Buffer.alloc(32);

function tryDecrypt(stored) {
  if (!stored || stored.split(':').length !== 3) return { ok: false, reason: 'not-encrypted-format' };
  try {
    const [iv, enc, tag] = stored.split(':').map((s) => Buffer.from(s, 'hex'));
    const d = crypto.createDecipheriv(ALG, KEY, iv);
    d.setAuthTag(tag);
    const out = Buffer.concat([d.update(enc), d.final()]).toString('utf8');
    return { ok: true, last6: out.slice(-6) };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

await connectDB();
const users = await User.find({ 'properties.0': { $exists: true } })
  .select('businessName properties')
  .lean();

let ok = 0, fail = 0;
console.log('DECRYPTION TEST (with this environment\'s key):');
for (const u of users) {
  for (const p of u.properties || []) {
    if (!p.smoobuApiKey || !String(p.smoobuApiKey).trim()) continue;
    const r = tryDecrypt(String(p.smoobuApiKey));
    if (r.ok) { ok++; console.log(`  ✓ ${u.businessName} → ...${r.last6}`); }
    else      { fail++; console.log(`  ✗ ${u.businessName} → ${r.reason}`); }
  }
}
console.log('─'.repeat(60));
console.log(`RESULT: ${ok} OK, ${fail} FAIL`);
if (fail > 0 && ok === 0) {
  console.log('→ Lahat bigo sa key na ito. Ang keyFingerprint dito ay HINDI tumutugma');
  console.log('  sa key na ginamit para i-encrypt ang DB. Compare fingerprint vs local.');
}

await disconnectDB();
process.exit(0);
