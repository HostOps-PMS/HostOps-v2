import fs from 'fs';
import path from 'path';
import * as counters from './csvCounters.js';

const LOG_DIR      = process.env.HONEYPOT_LOG_DIR || './logs';
export const EVENTS_FILE  = path.join(LOG_DIR, 'honeypot-events.csv');
export const BLOCK_FILE   = path.join(LOG_DIR, 'honeypot-blocklist.csv');

const EVENTS_HEADER =
  'timestamp,sessionId,ipAddress,deviceFingerprint,activityType,' +
  'severity,confidenceScore,classification,payload,tags,userAgent,decoyResponse\n';

const BLOCK_HEADER =
  'bannedAt,deviceFingerprint,ipAddresses,reason,confidenceScore,classification,expiresAt\n';

// Ensure log dir and files exist with headers on first run
function ensureFiles() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, EVENTS_HEADER);
  if (!fs.existsSync(BLOCK_FILE))  fs.writeFileSync(BLOCK_FILE,  BLOCK_HEADER);
}

// Escape a single CSV cell value
function esc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

// Internal async write queue — prevents interleaved rows under concurrency
const queue = [];
let writing = false;

async function drain() {
  if (writing || queue.length === 0) return;
  writing = true;
  while (queue.length > 0) {
    const { file, row } = queue.shift();
    try {
      await fs.promises.appendFile(file, row);
    } catch (err) {
      process.stderr.write(`[csvLogger] write error: ${err.message}\n`);
    }
  }
  writing = false;
}

function enqueue(file, row) {
  queue.push({ file, row });
  drain();   // fire-and-forget — never awaited by caller
}

// Public API
export function logEvent(fields) {
  try {
    ensureFiles();
    const ts = fields.timestamp || new Date().toISOString();
    const row = [
      esc(ts),
      esc(fields.sessionId),
      esc(fields.ipAddress),
      esc(fields.deviceFingerprint),
      esc(fields.activityType),
      esc(fields.severity),
      esc(fields.confidenceScore),
      esc(fields.classification),
      esc(typeof fields.payload === 'object'
            ? JSON.stringify(fields.payload) : fields.payload),
      esc(Array.isArray(fields.tags) ? fields.tags.join('|') : fields.tags),
      esc(fields.userAgent),
      esc(fields.decoyResponse),
    ].join(',') + '\n';
    enqueue(EVENTS_FILE, row);
    counters.recordEvent(fields.severity, new Date(ts).getTime());
  } catch (err) {
    process.stderr.write(`[csvLogger] logEvent error: ${err.message}\n`);
  }
}

export function logBlock(fields) {
  try {
    ensureFiles();
    const row = [
      esc(fields.bannedAt          || new Date().toISOString()),
      esc(fields.deviceFingerprint),
      esc(Array.isArray(fields.ipAddresses)
            ? fields.ipAddresses.join('|') : fields.ipAddresses),
      esc(fields.reason),
      esc(fields.confidenceScore),
      esc(fields.classification),
      esc(fields.expiresAt         || 'permanent'),
    ].join(',') + '\n';
    enqueue(BLOCK_FILE, row);
    counters.recordBan();
  } catch (err) {
    process.stderr.write(`[csvLogger] logBlock error: ${err.message}\n`);
  }
}
