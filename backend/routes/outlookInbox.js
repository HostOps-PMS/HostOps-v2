import express from 'express';
import crypto from 'crypto';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import InboxEmail from '../models/InboxEmail.js';

const router = express.Router();

// POST /api/inbox/webhook — called by Power Automate when a [BUG REPORT] email arrives
// Protected by a shared secret (set INBOX_WEBHOOK_SECRET in .env)
router.post('/inbox/webhook', async (req, res) => {
  try {
    const secret = req.headers['x-webhook-secret'] || req.body?.secret;
    const expected = process.env.INBOX_WEBHOOK_SECRET;
    const given    = Buffer.from(String(secret || ''));
    // Constant-time compare so the secret can't be recovered by timing.
    if (!expected || given.length !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(given, Buffer.from(expected))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { messageId, conversationId, subject, from, fromName, body, bodyPreview, receivedAt } = req.body;

    if (!subject) return res.status(400).json({ error: 'subject is required' });

    // Deduplicate by messageId
    const existing = messageId ? await InboxEmail.findOne({ messageId }) : null;
    if (existing) return res.json({ ok: true, duplicate: true });

    // Build a conversationId from subject if Power Automate doesn't provide one
    const cid = conversationId || subject.replace(/\s+/g, '-').toLowerCase().slice(0, 80);

    const preview = bodyPreview || (body ? body.replace(/<[^>]+>/g, '').slice(0, 200) : '');

    await InboxEmail.create({
      messageId:      messageId || null,
      conversationId: cid,
      subject:        subject.trim(),
      from:           from || '',
      fromName:       fromName || from || '',
      body:           body || '',
      bodyPreview:    preview,
      receivedAt:     receivedAt ? new Date(receivedAt) : new Date(),
      isRead:         false,
    });

    console.log('[Inbox] Webhook received:', subject, 'from', from);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Inbox] Webhook error:', err.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

// GET /api/inbox/threads — list bug report email threads grouped by conversationId
router.get('/inbox/threads', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const emails = await InboxEmail.find()
      .sort({ receivedAt: -1 })
      .limit(200)
      .lean();

    const threadMap = {};
    for (const email of emails) {
      const cid = email.conversationId || email._id.toString();
      if (!threadMap[cid]) {
        threadMap[cid] = {
          conversationId: cid,
          subject:        email.subject,
          latestDate:     email.receivedAt,
          messageCount:   0,
          hasUnread:      false,
          preview:        email.bodyPreview,
          from:           email.fromName || email.from || '—',
        };
      }
      threadMap[cid].messageCount++;
      if (!email.isRead) threadMap[cid].hasUnread = true;
      if (new Date(email.receivedAt) > new Date(threadMap[cid].latestDate)) {
        threadMap[cid].latestDate = email.receivedAt;
        threadMap[cid].preview    = email.bodyPreview;
        threadMap[cid].from       = email.fromName || email.from || '—';
      }
    }

    const threads = Object.values(threadMap)
      .sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));

    res.json(threads);
  } catch (err) {
    next(err);
  }
});

// GET /api/inbox/threads/:conversationId — full thread with HTML bodies
router.get('/inbox/threads/:conversationId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const emails = await InboxEmail.find({ conversationId: req.params.conversationId })
      .sort({ receivedAt: 1 })
      .lean();

    // Shape to match what the frontend expects (Graph API message format)
    const shaped = emails.map(e => ({
      id:               e._id.toString(),
      subject:          e.subject,
      receivedDateTime: e.receivedAt,
      isRead:           e.isRead,
      from: {
        emailAddress: { name: e.fromName || e.from, address: e.from },
      },
      body: { content: e.body, contentType: 'html' },
    }));

    res.json(shaped);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/inbox/threads/:conversationId/read — mark thread as read
router.patch('/inbox/threads/:conversationId/read', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await InboxEmail.updateMany({ conversationId: req.params.conversationId }, { isRead: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
