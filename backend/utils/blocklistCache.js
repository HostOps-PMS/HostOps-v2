import HoneypotBlocklist from '../models/honeypotBlocklist.js';

const banned = new Set();   // deviceFingerprint strings
let loaded = false;

async function load() {
  if (loaded) return;
  try {
    const docs = await HoneypotBlocklist.find({}, { deviceFingerprint: 1 }).lean();
    for (const doc of docs) {
      if (doc.deviceFingerprint) banned.add(doc.deviceFingerprint);
    }
    loaded = true;
  } catch (err) {
    process.stderr.write(`[blocklistCache] load error: ${err.message}\n`);
  }
}

export function add(fingerprint) { banned.add(fingerprint); }
export function has(fingerprint) { return banned.has(fingerprint); }

// Ensure cache is populated — called once DB is ready
export { load };

