import express from 'express';
import path from 'path';
import * as counters from '../../utils/csvCounters.js';
import { EVENTS_FILE, BLOCK_FILE } from '../../utils/csvLogger.js';
import fs from 'fs';

const router = express.Router();

router.get('/stats', (req, res) => {
  res.json(counters.get());
});

router.get('/logs', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const { severity, ip, fingerprint } = req.query;

  try {
    if (!fs.existsSync(EVENTS_FILE)) return res.json({ logs: [], totalPages: 1 });
    
    const content = await fs.promises.readFile(EVENTS_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    
    // skip header
    let logs = lines.slice(1).map(line => {
      // Regex to properly split CSV respecting double quotes
      const row = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && line[i+1] === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(current);
            current = '';
        } else {
            current += char;
        }
      }
      row.push(current); // last column
      
      return {
        timestamp: row[0] || '',
        sessionId: row[1] || '',
        ipAddress: row[2] || '',
        deviceFingerprint: row[3] || '',
        activityType: row[4] || '',
        severity: row[5] || '',
        confidenceScore: row[6] || '',
        classification: row[7] || '',
        payload: row[8] || '',
        tags: row[9] || '',
        userAgent: row[10] || '',
        decoyResponse: row[11] || ''
      };
    });

    if (severity) logs = logs.filter(l => l.severity === severity);
    if (ip) logs = logs.filter(l => l.ipAddress.includes(ip));
    if (fingerprint) logs = logs.filter(l => l.deviceFingerprint === fingerprint);

    logs.reverse(); // newest first
    const totalPages = Math.ceil(logs.length / limit);
    const paginated = logs.slice((page - 1) * limit, page * limit);

    res.json({ logs: paginated, totalPages: Math.max(1, totalPages) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024; // 100 MB

router.get('/download/events', async (req, res) => {
  try {
    const resolved = path.resolve(EVENTS_FILE);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'No events file found' });
    const stat = await fs.promises.stat(resolved);
    if (stat.size > MAX_DOWNLOAD_BYTES) {
      return res.status(413).json({ error: `Events file too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Please contact an administrator.` });
    }
    res.download(resolved, 'honeypot-events.csv');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/download/blocklist', async (req, res) => {
  try {
    const resolved = path.resolve(BLOCK_FILE);
    if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'No blocklist file found' });
    const stat = await fs.promises.stat(resolved);
    if (stat.size > MAX_DOWNLOAD_BYTES) {
      return res.status(413).json({ error: `Blocklist file too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Please contact an administrator.` });
    }
    res.download(resolved, 'honeypot-blocklist.csv');
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
