import HoneypotEvent from '../models/honeypotEvent.js';
import HoneypotBlocklist from '../models/honeypotBlocklist.js';
import * as counters from './dbCounters.js';

// Public API
export function logEvent(fields) {
  try {
    const ts = fields.timestamp ? new Date(fields.timestamp) : new Date();
    
    // Fire and forget
    HoneypotEvent.create({
      timestamp: ts,
      sessionId: fields.sessionId || '',
      ipAddress: fields.ipAddress || '',
      deviceFingerprint: fields.deviceFingerprint || '',
      activityType: fields.activityType || '',
      severity: fields.severity || '',
      confidenceScore: Number(fields.confidenceScore) || 0,
      classification: fields.classification || '',
      payload: typeof fields.payload === 'object' ? JSON.stringify(fields.payload) : (fields.payload || '{}'),
      tags: Array.isArray(fields.tags) ? fields.tags : (fields.tags ? [fields.tags] : []),
      userAgent: fields.userAgent || '',
      decoyResponse: fields.decoyResponse || ''
    }).catch(err => {
      process.stderr.write(`[dbLogger] logEvent create error: ${err.message}\n`);
    });

    counters.recordEvent(fields.severity, ts.getTime());
  } catch (err) {
    process.stderr.write(`[dbLogger] logEvent error: ${err.message}\n`);
  }
}

export function logBlock(fields) {
  try {
    const ts = fields.bannedAt ? new Date(fields.bannedAt) : new Date();

    // Fire and forget
    HoneypotBlocklist.create({
      bannedAt: ts,
      deviceFingerprint: fields.deviceFingerprint || '',
      ipAddresses: Array.isArray(fields.ipAddresses) ? fields.ipAddresses : (fields.ipAddresses ? [fields.ipAddresses] : []),
      reason: fields.reason || '',
      confidenceScore: Number(fields.confidenceScore) || 0,
      classification: fields.classification || '',
      expiresAt: fields.expiresAt && fields.expiresAt !== 'permanent' ? new Date(fields.expiresAt) : null
    }).catch(err => {
      process.stderr.write(`[dbLogger] logBlock create error: ${err.message}\n`);
    });

    counters.recordBan();
  } catch (err) {
    process.stderr.write(`[dbLogger] logBlock error: ${err.message}\n`);
  }
}
