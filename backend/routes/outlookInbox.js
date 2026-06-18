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

async function graph(path, token, { search = false } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  if (search) {
    headers['ConsistencyLevel'] = 'eventual';
  }
  const res = await fetch(`${GRAPH_BASE}${path}`, { headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const code = body.error?.code || 'unknown';
    const msg  = body.error?.message || `HTTP ${res.status}`;
    console.error('[Graph] Error:', { status: res.status, code, message: msg, path });
    throw new Error(`[${code}] ${msg}`);
  }
  return res.json();
}

// GET /api/inbox/debug — step-by-step permission diagnostic
router.get('/inbox/debug', requireAuth, requireAdmin, async (req, res) => {
  const steps = [];
  try {
    // Step 1: Get token
    const token = await getToken();
    steps.push({ step: 'auth', ok: true, note: 'Token obtained successfully' });

    // Step 2: List the app's permissions via /me (will fail for app-only, expected)
    // Try reading the mailbox user profile
    try {
      const userRes = await fetch(`${GRAPH_BASE}/users/${MAILBOX}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const userData = await userRes.json();
      if (userRes.ok) {
        steps.push({ step: 'read_user', ok: true, note: `User found: ${userData.displayName} (${userData.mail})` });
      } else {
        steps.push({ step: 'read_user', ok: false, code: userData.error?.code, message: userData.error?.message });
      }
    } catch (e) {
      steps.push({ step: 'read_user', ok: false, message: e.message });
    }

    // Step 3: Try to list mailFolders (requires Mail.Read Application)
    try {
      const foldersRes = await fetch(`${GRAPH_BASE}/users/${MAILBOX}/mailFolders?$top=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const foldersData = await foldersRes.json();
      if (foldersRes.ok) {
        steps.push({ step: 'list_folders', ok: true, note: `Found ${foldersData.value?.length ?? 0} folders` });
      } else {
        steps.push({ step: 'list_folders', ok: false, code: foldersData.error?.code, message: foldersData.error?.message });
      }
    } catch (e) {
      steps.push({ step: 'list_folders', ok: false, message: e.message });
    }

    // Step 4: Try to read messages (top 3, no search)
    try {
      const msgRes = await fetch(`${GRAPH_BASE}/users/${MAILBOX}/messages?$top=3&$select=id,subject,from,receivedDateTime`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const msgData = await msgRes.json();
      if (msgRes.ok) {
        steps.push({ step: 'list_messages', ok: true, note: `Found ${msgData.value?.length ?? 0} messages`, subjects: msgData.value?.map(m => m.subject) });
      } else {
        steps.push({ step: 'list_messages', ok: false, code: msgData.error?.code, message: msgData.error?.message });
      }
    } catch (e) {
      steps.push({ step: 'list_messages', ok: false, message: e.message });
    }

    res.json({ mailbox: MAILBOX, steps });
  } catch (err) {
    steps.push({ step: 'auth', ok: false, message: err.message });
    res.status(500).json({ mailbox: MAILBOX, steps, error: err.message });
  }
});

// GET /api/inbox/threads — list bug report email threads
router.get('/inbox/threads', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const token  = await getToken();
    const search = encodeURIComponent('"[BUG REPORT]" "[HostOps]"');
    const select = 'id,subject,from,receivedDateTime,conversationId,bodyPreview,isRead';

    const data = await graph(
      `/users/${MAILBOX}/messages?$search=${search}&$select=${select}&$top=100`,
      token,
      { search: true }
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
