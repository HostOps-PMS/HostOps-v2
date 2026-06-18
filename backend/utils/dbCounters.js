import HoneypotEvent from '../models/honeypotEvent.js';
import HoneypotBlocklist from '../models/honeypotBlocklist.js';

let counters = { last24h: 0, criticalLast24h: 0, bannedTotal: 0 };
const DAY_MS = 24 * 60 * 60 * 1000;
let lastInit = 0;
let initPromise = null;

async function doInit() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - DAY_MS);

    const [last24h, criticalLast24h, bannedTotal] = await Promise.all([
      HoneypotEvent.countDocuments({ timestamp: { $gte: oneDayAgo } }),
      HoneypotEvent.countDocuments({ timestamp: { $gte: oneDayAgo }, severity: 'critical' }),
      HoneypotBlocklist.countDocuments()
    ]);

    counters = { last24h, criticalLast24h, bannedTotal };
  } catch (err) {
    process.stderr.write(`[dbCounters] init error: ${err.message}\n`);
  }
}

function init() {
  if (Date.now() - lastInit < 60000) return;
  lastInit = Date.now();
  // Fetch asynchronously so we don't block
  if (!initPromise) {
    initPromise = doInit().finally(() => {
      initPromise = null;
    });
  }
}

export function recordEvent(severity, timestamp = Date.now()) {
  init();
  if (Date.now() - timestamp < DAY_MS) {
    counters.last24h++;
    if (severity === 'critical') counters.criticalLast24h++;
  }
}

export function recordBan() { 
  init();
  counters.bannedTotal++; 
}

export async function get() { 
  if (Date.now() - lastInit >= 60000) {
    lastInit = Date.now();
    await doInit();
  }
  return { ...counters }; 
}
