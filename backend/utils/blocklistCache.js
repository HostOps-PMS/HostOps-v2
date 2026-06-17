import fs from 'fs';
import { BLOCK_FILE } from './csvLogger.js';

const banned = new Set();   // deviceFingerprint strings

function load() {
  try {
    if (!fs.existsSync(BLOCK_FILE)) return;
    const lines = fs.readFileSync(BLOCK_FILE, 'utf8').split('\n').slice(1); // skip header
    for (const line of lines) {
      const row = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i+1] === '"') { current += '"'; i++; }
        else if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { row.push(current); current = ''; }
        else current += char;
      }
      row.push(current);
      const fp = row[1];
      if (fp) banned.add(fp);
    }
  } catch (err) {
    process.stderr.write(`[blocklistCache] load error: ${err.message}\n`);
  }
}

export function add(fingerprint) { banned.add(fingerprint); }
export function has(fingerprint) { return banned.has(fingerprint); }

load();   // populate at module load time
