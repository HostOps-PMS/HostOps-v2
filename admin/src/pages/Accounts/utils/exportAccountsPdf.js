/**
 * exportAccountsPdf.js
 * Generates and downloads a PDF of the currently filtered accounts list.
 * Uses only the browser's built-in print API — zero extra dependencies.
 *
 * @param {{
 *   accounts:      object[],  — the full filtered rows to export (all pages)
 *   activeTab:     string,    — 'all' | 'users' | 'staffs' | 'locked'
 *   search?:       string,    — current search query (shown in header)
 *   dateExported?: string,    — optional override; defaults to today
 * }} opts
 */
export function exportAccountsPdf({ accounts = [], activeTab = 'all', search = '', dateExported } = {}) {
  const date = dateExported || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const now = new Date();

  function fmt(date) {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function getPinStatus(a) {
    if (a.pinPermanentlyLocked) return { label: 'Permanently Locked', cls: 'badge--locked' };
    if (a.pinLockedUntil && new Date(a.pinLockedUntil) > now) return { label: 'Temporarily Locked', cls: 'badge--temp' };
    if (a.pinAttempts > 0) return { label: `${a.pinAttempts} Attempt(s)`, cls: 'badge--attempts' };
    return { label: 'OK', cls: 'badge--ok' };
  }

  const tabLabel = {
    all: 'All Accounts',
    users: 'Users',
    staffs: 'Staffs',
    locked: 'PIN Issues',
  }[activeTab] || 'All Accounts';

  const rows = accounts.map((a, i) => {
    const pin = getPinStatus(a);
    return `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${i + 1}</td>
      <td>
        <div class="acc-name">${a.name || '—'}</div>
        <div class="acc-email">${a.email || '—'}</div>
      </td>
      <td><span class="badge badge--type-${a.accountType}">${a.accountType === 'user' ? 'User' : 'Staff'}</span></td>
      <td>${a.role || '—'}</td>
      <td><span class="badge ${pin.cls}">${pin.label}</span></td>
      <td>${a.pinAttempts ?? 0}</td>
      <td>${fmt(a.pinLockedUntil)}</td>
      <td>${fmt(a.lastLoginAt)}</td>
    </tr>
  `;
  }).join('');

  const filterLabel = [
    `Tab: ${tabLabel}`,
    search.trim() ? `Search: "${search.trim()}"` : '',
  ].filter(Boolean).join('  ·  ');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Accounts Export — ${date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #111827;
      background: #fff;
      padding: 32px 36px;
    }

    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #10b981;
    }
    .header__logo  { font-size: 18px; font-weight: 800; color: #10b981; letter-spacing: -0.02em; }
    .header__title { font-size: 14px; font-weight: 700; color: #111827; margin-top: 4px; }
    .header__meta  { text-align: right; font-size: 10px; color: #6b7280; line-height: 1.6; }

    .summary {
      display: flex; gap: 6px; align-items: center;
      margin-bottom: 14px; font-size: 10px; color: #6b7280;
    }
    .summary__pill  { padding: 2px 10px; border-radius: 999px; background: #f3f4f6; font-weight: 600; color: #374151; }
    .summary__count { margin-left: auto; font-weight: 600; color: #111827; }

    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    thead tr { background: #f0fdf4; }
    th {
      padding: 8px 10px; text-align: left; font-size: 9px; font-weight: 700;
      color: #6b7280; letter-spacing: 0.07em; text-transform: uppercase;
      border-bottom: 1px solid #d1fae5; white-space: nowrap;
    }
    td { padding: 8px 10px; vertical-align: middle; border-bottom: 1px solid #f3f4f6; }
    tr.odd td  { background: #fafafa; }
    tr.even td { background: #fff; }

    .acc-name  { font-weight: 600; color: #111827; }
    .acc-email { font-size: 9.5px; color: #9ca3af; margin-top: 1px; }

    .badge {
      display: inline-block; padding: 2px 8px;
      border-radius: 4px; font-size: 9px; font-weight: 700;
    }
    .badge--type-user   { background: #eff6ff; color: #2563eb; }
    .badge--type-staff  { background: #f0fdf4; color: #16a34a; }
    .badge--locked      { background: #fee2e2; color: #b91c1c; }
    .badge--temp        { background: #fff7ed; color: #c2410c; }
    .badge--attempts    { background: #fef9c3; color: #854d0e; }
    .badge--ok          { background: #f0fdf4; color: #16a34a; }

    .footer {
      margin-top: 20px; padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      font-size: 9px; color: #9ca3af;
      display: flex; justify-content: space-between;
    }

    .empty { padding: 40px 0; text-align: center; color: #9ca3af; font-size: 11px; }

    @media print {
      body { padding: 20px 24px; }
      @page { margin: 0.5in; size: A4 landscape; }
    }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <div class="header__logo">HostOps</div>
      <div class="header__title">Accounts Report</div>
    </div>
    <div class="header__meta">
      Exported: ${date}<br/>
      Generated by Admin
    </div>
  </div>

  <div class="summary">
    <span class="summary__pill">${filterLabel}</span>
    <span class="summary__count">${accounts.length} ${accounts.length === 1 ? 'Account' : 'Accounts'}</span>
  </div>

  ${accounts.length === 0
    ? '<div class="empty">No accounts match the current filter.</div>'
    : `<table>
        <thead>
          <tr>
            <th>#</th>
            <th>Account</th>
            <th>Type</th>
            <th>Role</th>
            <th>PIN Status</th>
            <th>Attempts</th>
            <th>Locked Until</th>
            <th>Last Login</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
  }

  <div class="footer">
    <span>HostOps Admin Dashboard</span>
    <span>Page 1</span>
  </div>

</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2000);
    }
  }, 400);
}