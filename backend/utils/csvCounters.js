import fs from 'fs';
import { EVENTS_FILE, BLOCK_FILE } from './csvLogger.js';

let counters = { last24h: 0, criticalLast24h: 0, bannedTotal: 0 };
const DAY_MS = 24 * 60 * 60 * 1000;
let lastInit = 0;

function init() {
  if (Date.now() - lastInit < 60000) return;
  lastInit = Date.now();
  try {
    const now = Date.now();
    counters = { last24h: 0, criticalLast24h: 0, bannedTotal: 0 };
    if (fs.existsSync(EVENTS_FILE)) {
      const lines = fs.readFileSync(EVENTS_FILE, 'utf8').split('\n').slice(1);
      for (const line of lines) {
        if (!line.trim()) continue;
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
        const ts = new Date(row[0]).getTime();
        if (now - ts < DAY_MS) {
          counters.last24h++;
          if (row[5] === 'critical') counters.criticalLast24h++;
        }
      }
    }
    if (fs.existsSync(BLOCK_FILE)) {
      const lines = fs.readFileSync(BLOCK_FILE, 'utf8').split('\n').slice(1);
      for (const line of lines) {
        if (line.trim()) counters.bannedTotal++;
      }
    }
  } catch (err) {
    process.stderr.write(`[csvCounters] init error: ${err.message}\n`);
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

export function get() { 
  init();
  return { ...counters }; 
}
