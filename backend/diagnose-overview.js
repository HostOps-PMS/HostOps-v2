// diagnose-overview.js
// ─────────────────────────────────────────────────────────────────
// READ-ONLY. Patakbuhin mula sa backend root:
//   node diagnose-overview.js
//
// Sasagutin nito: Bakit "0 of 0 mapped" / "All business accounts (0)"?
//   • Ilang user per role
//   • Ilang properties per role
//   • Ilang property ang may smoobuApiKey (encrypted at rest)
//   • Ilang key ang matagumpay na nade-decrypt
// ─────────────────────────────────────────────────────────────────
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './config/db.js';
import User from './models/user.js';
import { decrypt } from './utils/encryption.js';

await connectDB();

const roles = ['client', 'admin', 'team_leader'];
console.log('ROLE COUNTS');
for (const r of roles) {
  const c = await User.countDocuments({ role: r });
  console.log(`  ${r.padEnd(12)} : ${c}`);
}
console.log(`  ${'(no role)'.padEnd(12)} : ${await User.countDocuments({ role: { $exists: false } })}`);
console.log('─'.repeat(56));

// Mimic the overview query (all 3 roles), with properties
const all = await User.find({ role: { $in: roles } })
  .select('businessName email role properties propertyTagPrefix')
  .lean();

let totalProps = 0, withKey = 0, decryptOk = 0, decryptFail = 0;
const sample = [];

for (const u of all) {
  const props = Array.isArray(u.properties) ? u.properties : [];
  totalProps += props.length;
  for (const p of props) {
    if (p.smoobuApiKey && String(p.smoobuApiKey).trim()) {
      withKey++;
      try {
        const out = decrypt(p.smoobuApiKey);
        // decrypt() returns the input unchanged on failure, so detect that:
        const looksEncrypted = String(p.smoobuApiKey).split(':').length === 3;
        const stillEncrypted = String(out).split(':').length === 3 && out === p.smoobuApiKey;
        if (looksEncrypted && stillEncrypted) decryptFail++;
        else { decryptOk++; if (sample.length < 3) sample.push(`${u.businessName}: ...${String(out).slice(-6)}`); }
      } catch {
        decryptFail++;
      }
    }
  }
}

console.log('PROPERTIES');
console.log(`  users matched (3 roles) : ${all.length}`);
console.log(`  total properties        : ${totalProps}`);
console.log(`  with smoobuApiKey       : ${withKey}`);
console.log(`  decrypt OK              : ${decryptOk}`);
console.log(`  decrypt FAIL            : ${decryptFail}`);
if (sample.length) console.log('  sample decrypted (last6):', sample);
console.log('─'.repeat(56));

console.log('DIAGNOSIS:');
if (all.length === 0)        console.log('  → Walang user sa 3 roles. Tingnan kung ano talaga ang role values sa DB.');
else if (totalProps === 0)   console.log('  → May users pero walang properties. Walang ipo-plot.');
else if (withKey === 0)      console.log('  → May properties pero walang smoobuApiKey naka-set.');
else if (decryptOk === 0)    console.log('  → Lahat ng key BIGO mag-decrypt. Ito ang nag-block sa map+revenue. (encryption issue)');
else                         console.log(`  → ${decryptOk} key OK — dapat may lumalabas. Kung wala pa rin, frontend wiring ang problema.`);

await disconnectDB();
process.exit(0);
