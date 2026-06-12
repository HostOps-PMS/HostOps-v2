/**
 * exportClientsPdf.js
 * Generates and downloads a PDF of the currently filtered client list.
 *
 * Uses only the browser's built-in print API so there are zero extra
 * dependencies. A hidden <iframe> is injected, filled with a styled
 * HTML table, and printed — the browser's Save-as-PDF dialog handles
 * the rest.
 *
 * @param {{
 *   clients:    object[],   — the filtered/visible rows to export
 *   activeTab:  string,     — e.g. "All" | "Verified" | "Partial" | "Unverified"
 *   search:     string,     — current search query (shown in header)
 *   dateExported?: string,  — optional override; defaults to today
 * }} opts
 */
export function exportClientsPdf({ clients = [], activeTab = 'All', search = '', dateExported } = {}) {
  const date = dateExported || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  }

  function getStatus(client) {
    if (client.mustChangePassword && client.mustChangePin) return 'Unverified';
    if (!client.mustChangePassword && !client.mustChangePin) return 'Verified';
    return 'Partially Verified';
  }

  function getRole(role) {
    if (role === 'admin') return 'Admin';
    if (role === 'team_leader') return 'Team Leader';
    return 'Client';
  }

  const rows = clients.map((c, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${i + 1}</td>
      <td>
        <div class="biz-name">${c.businessName || '—'}</div>
        <div class="biz-email">${c.email || '—'}</div>
      </td>
      <td>${getRole(c.role)}</td>
      <td><span class="badge badge--${getStatus(c).toLowerCase().replace(' ', '-')}">${getStatus(c)}</span></td>
      <td>${formatDate(c.lastLoginAt)}</td>
      <td>${formatDate(c.createdAt)}</td>
    </tr>
  `).join('');

  const filterLabel = [
    activeTab !== 'All' ? `Tab: ${activeTab}` : '',
    search.trim() ? `Search: "${search.trim()}"` : '',
  ].filter(Boolean).join('  ·  ') || 'All businesses';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Businesses Export — ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #111827;
      background: #fff;
      padding: 32px 36px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #10b981;
    }
    .header__logo {
      font-size: 18px;
      font-weight: 800;
      color: #10b981;
      letter-spacing: -0.02em;
    }
    .header__meta {
      text-align: right;
      font-size: 10px;
      color: #6b7280;
      line-height: 1.6;
    }
    .header__title {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      margin-top: 4px;
    }

    /* ── Summary bar ── */
    .summary {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 14px;
      font-size: 10px;
      color: #6b7280;
    }
    .summary__pill {
      padding: 2px 10px;
      border-radius: 999px;
      background: #f3f4f6;
      font-weight: 600;
      color: #374151;
    }
    .summary__count {
      margin-left: auto;
      font-weight: 600;
      color: #111827;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    thead tr {
      background: #f0fdf4;
    }
    th {
      padding: 8px 10px;
      text-align: left;
      font-size: 9px;
      font-weight: 700;
      color: #6b7280;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      border-bottom: 1px solid #d1fae5;
      white-space: nowrap;
    }
    td {
      padding: 8px 10px;
      vertical-align: middle;
      border-bottom: 1px solid #f3f4f6;
    }
    tr.odd td {
      background: #fafafa;
    }
    tr.even td {
      background: #fff;
    }

    /* ── Cell helpers ── */
    .biz-name {
      font-weight: 600;
      color: #111827;
    }
    .biz-email {
      font-size: 9.5px;
      color: #9ca3af;
      margin-top: 1px;
    }

    /* ── Status badges ── */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
    }
    .badge--verified           { background: #f0fdf4; color: #16a34a; }
    .badge--unverified         { background: #fff8e1; color: #7a6a00; }
    .badge--partially-verified { background: #eff6ff; color: #2563eb; }

    /* ── Footer ── */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 9px;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    }

    /* ── Empty state ── */
    .empty {
      padding: 40px 0;
      text-align: center;
      color: #9ca3af;
      font-size: 11px;
    }

    @media print {
      body { padding: 20px 24px; }
      @page { margin: 0.5in; size: A4 landscape; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="header__logo">HostPilot</div>
      <div class="header__title">Businesses Report</div>
    </div>
    <div class="header__meta">
      Exported: ${date}<br/>
      Generated by Admin
    </div>
  </div>

  <div class="summary">
    <span class="summary__pill">${filterLabel}</span>
    <span class="summary__count">${clients.length} ${clients.length === 1 ? 'Business' : 'Businesses'}</span>
  </div>

  ${clients.length === 0
    ? '<div class="empty">No businesses match the current filter.</div>'
    : `<table>
        <thead>
          <tr>
            <th>#</th>
            <th>Business</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
  }

  <div class="footer">
    <span>HostPilot Admin Dashboard</span>
    <span>Page 1</span>
  </div>

</body>
</html>`;

  // ── Inject a hidden iframe and trigger the print dialog ──────────
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Give the browser a tick to finish layout before printing
  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      // Remove the iframe ~2 s after printing so cleanup doesn't race
      // with the print dialog staying open
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2000);
    }
  }, 400);
}
