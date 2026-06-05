// diagnose-keys.js
// ─────────────────────────────────────────────────────────────────
// READ-ONLY diagnostic. Walang binabago sa DB.
// Patakbuhin mula sa backend root:
//   node diagnose-keys.js
//
// Sasabihin nito kung bakit nabibigo ang decryption ng smoobuApiKey:
//   • zero-key      → na-encrypt gamit ang fallback Buffer.alloc(32) (walang .env key noon)
//   • current-key   → tama, nade-decrypt ng kasalukuyang FIELD_ENCRYPTION_KEY
//   • double        → na-encrypt nang 2+ beses (kailangan ng multi-pass repair)
//   • unrecoverable → ibang key ang ginamit, hindi ma-recover
// ─────────────────────────────────────────────────────────────────
import 'dotenv/config';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import User from './models/user.js';

const ALG = 'aes-256-gcm';

function isEncrypted(val) {
  if (!val || typeof val !== 'string') return false;
  const p = val.split(':');
  return p.length === 3 && p[0].length === 24 && p[2].length === 32;
}

function tryDecrypt(stored, key) {
  if (!isEncrypted(stored)) return { ok: true, value: stored, wasPlain: true };
  try {
    const [iv, enc, tag] = stored.split(':').map((s) => Buffer.from(s, 'hex'));
    const d = crypto.createDecipheriv(ALG, key, iv);
    d.setAuthTag(tag);
    const out = Buffer.concat([d.update(enc), d.final()]).toString('utf8');
    return { ok: true, value: out, wasPlain: false };
  } catch {
    return { ok: false };
  }
}

// Peel encryption layers using a given key; returns how many layers + final value
function peel(stored, key, maxLayers = 5) {
  let cur = stored;
  let layers = 0;
  while (isEncrypted(cur) && layers < maxLayers) {
    const r = tryDecrypt(cur, key);
    if (!r.ok) return { layers, final: cur, stuck: true };
    cur = r.value;
    layers++;
    if (!isEncrypted(cur)) break;
  }
  return { layers, final: cur, stuck: isEncrypted(cur) };
}

const rawKey = process.env.FIELD_ENCRYPTION_KEY;
const currentKey = rawKey && rawKey.length === 64 ? Buffer.from(rawKey, 'hex') : null;
const zeroKey = Buffer.alloc(32);

console.log('FIELD_ENCRYPTION_KEY present:', !!rawKey, '| length:', rawKey?.length || 0, '(dapat 64)');
console.log('─'.repeat(60));

await connectDB();

const users = await User.find({ 'properties.0': { $exists: true } })
  .select('businessName email properties')
  .lean();

let totalKeys = 0;
const tally = { plain: 0, current: 0, zero: 0, double: 0, unrecoverable: 0 };

for (const u of users) {
  for (const p of u.properties || []) {
    const stored = p.smoobuApiKey;
    if (!stored) continue;
    totalKeys++;

    const label = `${u.businessName || u.email} › ${p.propertyName}`;

    if (!isEncrypted(stored)) {
      tally.plain++;
      console.log(`PLAINTEXT      | ${label}`);
      continue;
    }
    // Try current key, single layer
    if (currentKey && tryDecrypt(stored, currentKey).ok) {
      const peeled = peel(stored, currentKey);
      if (peeled.layers > 1) {
        tally.double++;
        console.log(`DOUBLE x${peeled.layers}      | ${label} (current key)`);
      } else {
        tally.current++;
        console.log(`OK (current)   | ${label}`);
      }
      continue;
    }
    // Try zero key (fallback used when .env key was missing at save time)
    if (tryDecrypt(stored, zeroKey).ok) {
      const peeled = peel(stored, zeroKey);
      tally.zero++;
      console.log(`ZERO-KEY x${peeled.layers}    | ${label} (encrypted w/ Buffer.alloc(32) fallback)`);
      continue;
    }
    tally.unrecoverable++;
    console.log(`UNRECOVERABLE  | ${label} (wrong/changed secret)`);
  }
}

console.log('─'.repeat(60));
console.log('Total keys:', totalKeys);
console.log(JSON.stringify(tally, null, 2));
console.log('\nDIAGNOSIS:');
if (tally.zero > 0)          console.log('→ May mga key na na-encrypt gamit ang ZERO fallback (walang .env key noon). Kailangan i-migrate.');
if (tally.double > 0)        console.log('→ May DOUBLE-encrypted keys. Kailangan ng multi-pass repair.');
if (tally.unrecoverable > 0) console.log('→ May UNRECOVERABLE keys. Iba ang secret na ginamit — kailangang i-re-enter ang Smoobu key.');
if (tally.current === totalKeys && totalKeys > 0) console.log('→ Lahat OK sa current key — ibang bug ang sanhi, hindi encryption.');

await disconnectDB();
process.exit(0);
