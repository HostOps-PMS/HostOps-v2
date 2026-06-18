import express from 'express';
import HoneypotEvent from '../../models/honeypotEvent.js';
import HoneypotBlocklist from '../../models/honeypotBlocklist.js';
import * as counters from '../../utils/dbCounters.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await counters.get();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 25;
  const { severity, ip, fingerprint } = req.query;

  try {
    const filter = {};
    if (severity) filter.severity = severity;
    if (ip) filter.ipAddress = { $regex: ip, $options: 'i' };
    if (fingerprint) filter.deviceFingerprint = fingerprint;

    const totalCount = await HoneypotEvent.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    const logs = await HoneypotEvent.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ logs, totalPages: Math.max(1, totalPages) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Escape a single CSV cell value
function esc(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s;
}

router.get('/download/events', async (req, res) => {
  try {
    const EVENTS_HEADER = 'timestamp,sessionId,ipAddress,deviceFingerprint,activityType,severity,confidenceScore,classification,payload,tags,userAgent,decoyResponse\n';
    
    // We stream the response to avoid keeping everything in memory
    res.setHeader('Content-disposition', 'attachment; filename=honeypot-events.csv');
    res.setHeader('Content-type', 'text/csv');
    res.write(EVENTS_HEADER);

    const cursor = HoneypotEvent.find().sort({ timestamp: -1 }).cursor();
    
    for await (const doc of cursor) {
      const row = [
        esc(doc.timestamp?.toISOString()),
        esc(doc.sessionId),
        esc(doc.ipAddress),
        esc(doc.deviceFingerprint),
        esc(doc.activityType),
        esc(doc.severity),
        esc(doc.confidenceScore),
        esc(doc.classification),
        esc(typeof doc.payload === 'object' ? JSON.stringify(doc.payload) : doc.payload),
        esc(Array.isArray(doc.tags) ? doc.tags.join('|') : doc.tags),
        esc(doc.userAgent),
        esc(doc.decoyResponse),
      ].join(',') + '\n';
      res.write(row);
    }
    
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

router.get('/download/blocklist', async (req, res) => {
  try {
    const BLOCK_HEADER = 'bannedAt,deviceFingerprint,ipAddresses,reason,confidenceScore,classification,expiresAt\n';
    
    res.setHeader('Content-disposition', 'attachment; filename=honeypot-blocklist.csv');
    res.setHeader('Content-type', 'text/csv');
    res.write(BLOCK_HEADER);

    const cursor = HoneypotBlocklist.find().sort({ bannedAt: -1 }).cursor();
    
    for await (const doc of cursor) {
      const row = [
        esc(doc.bannedAt?.toISOString()),
        esc(doc.deviceFingerprint),
        esc(Array.isArray(doc.ipAddresses) ? doc.ipAddresses.join('|') : doc.ipAddresses),
        esc(doc.reason),
        esc(doc.confidenceScore),
        esc(doc.classification),
        esc(doc.expiresAt ? doc.expiresAt.toISOString() : 'permanent'),
      ].join(',') + '\n';
      res.write(row);
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.end();
    }
  }
});

export default router;
