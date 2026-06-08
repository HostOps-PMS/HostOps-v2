// diagnose-key-format.js
// READ-ONLY. node diagnose-key-format.js
// Ipinapakita ang RAW format ng bawat smoobuApiKey (hindi buong value)
// para makita kung bakit napagkakamalang encrypted ang plaintext.
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import User from './models/user.js';

await connectDB();
const users = await User.find({ 'properties.0': { $exists: true } })
  .select('businessName properties')
  .lean();

function isEncryptedFormat(val) {
  if (!val || typeof val !== 'string') return false;
  const p = val.split(':');
  return p.length === 3 && p[0].length === 24 && p[2].length === 32;
}

console.log('RAW smoobuApiKey FORMAT INSPECTION');
console.log('═'.repeat(64));
for (const u of users) {
  for (const p of u.properties || []) {
    const v = p.smoobuApiKey;
    if (!v) continue;
    const s = String(v);
    const parts = s.split(':');
    const looksEnc = isEncryptedFormat(s);
    console.log(`${(u.businessName || '?').padEnd(16)} | len=${String(s.length).padEnd(4)} | colons=${parts.length - 1} | part0len=${parts[0]?.length ?? 0} | part2len=${parts[parts.length-1]?.length ?? 0} | isEncrypted=${looksEnc ? 'YES' : 'no '} | head="${s.slice(0,6)}..." `);
  }
}
console.log('═'.repeat(64));
console.log('NOTE: isEncrypted=YES dapat AES format. Kung plaintext Smoobu key');
console.log('na may ":" (rare), baka mali-detect. Karaniwang Smoobu key = walang ":".');

await disconnectDB();
process.exit(0);