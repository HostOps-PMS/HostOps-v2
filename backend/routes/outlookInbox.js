import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();
const MAILBOX    = 'innovation@telexph.com';
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

let _token       = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        scope:         'https://graph.microsoft.com/.default',
      }),
    }
  );

  if (!res.ok) throw new Error(`Microsoft auth failed: ${res.statusText}`);
  const data   = await res.json();
  _token       = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

async function graph(path, token) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graph API error: ${res.status}`);
  }
  return res.json();
}

// GET /api/inbox/threads — list bug report email threads
router.get('/inbox/threads', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const token  = await getToken();
    const search = encodeURIComponent('"[BUG REPORT]" "[HostOps]"');
    const select = 'id,subject,from,receivedDateTime,conversationId,bodyPreview,isRead';

    const data = await graph(
      `/users/${MAILBOX}/messages?$search=${search}&$select=${select}&$top=100`,
      token
    );

    // Filter to only messages whose subject contains both keywords
    const messages = (data.value || []).filter(m =>
      m.subject?.includes('[BUG REPORT]') && m.subject?.includes('[HostOps]')
    );

    // Group by conversationId, keep latest message metadata per thread
    const threadMap = {};
    for (const msg of messages) {
      const cid = msg.conversationId;
      if (!threadMap[cid]) {
        threadMap[cid] = {
          conversationId: cid,
          subject:        msg.subject,
          latestDate:     msg.receivedDateTime,
          messageCount:   0,
          hasUnread:      false,
          preview:        msg.bodyPreview,
          from:           msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || '—',
        };
      }
      threadMap[cid].messageCount++;
      if (!msg.isRead) threadMap[cid].hasUnread = true;
      if (new Date(msg.receivedDateTime) > new Date(threadMap[cid].latestDate)) {
        threadMap[cid].latestDate = msg.receivedDateTime;
        threadMap[cid].preview    = msg.bodyPreview;
        threadMap[cid].from       = msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || '—';
      }
    }

    const threads = Object.values(threadMap)
      .sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate));

    res.json(threads);
  } catch (err) {
    console.error('[Inbox] threads error:', err.message);
    next(err);
  }
});

// GET /api/inbox/threads/:conversationId — full thread messages with body
router.get('/inbox/threads/:conversationId', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const token  = await getToken();
    const cid    = req.params.conversationId;
    const filter = encodeURIComponent(`conversationId eq '${cid}'`);
    const select = 'id,subject,from,toRecipients,receivedDateTime,body,isRead';

    const data = await graph(
      `/users/${MAILBOX}/messages?$filter=${filter}&$select=${select}&$orderby=receivedDateTime asc`,
      token
    );

    res.json(data.value || []);
  } catch (err) {
    console.error('[Inbox] thread detail error:', err.message);
    next(err);
  }
});

export default router;
