/**
 * exportActivityLogsPdf.js
 * Fetches ALL filtered activity logs from the server (bypassing pagination)
 * then generates a PDF via the browser's built-in print API.
 *
 * @param {{
 *   exportFn:      () => Promise<object[]>,  — async fn that returns all logs
 *   search?:       string,                   — client-side search query
 *   filterClient?: string,                   — active client filter label
 *   filterAction?: string,                   — active action filter
 *   filterDateFrom?: string,
 *   filterDateTo?:   string,
 *   dateExported?:   string,
 * }} opts
 */
export async function exportActivityLogsPdf({
  exportFn,
  search = '',
  filterClient = '',
  filterAction = '',
  filterDateFrom = '',
  filterDateTo = '',
  dateExported,
} = {}) {
  const date = dateExported || new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Fetch all logs from server
  let allLogs = await exportFn();

  // Apply client-side text search on top (same logic as index.jsx)
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    allLogs = allLogs.filter(log => {
      const pb = log.performedBy || {};
      return (
        pb.firstName?.toLowerCase().includes(q) ||
        pb.lastName?.toLowerCase().includes(q)  ||
        pb.email?.toLowerCase().includes(q)     ||
        log.action?.toLowerCase().includes(q)   ||
        log.businessName?.toLowerCase().includes(q)
      );
    });
  }

  function fmt(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatAction(action = '') {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const rows = allLogs.map((log, i) => {
    const pb       = log.performedBy || {};
    const actor    = [pb.firstName, pb.lastName].filter(Boolean).join(' ') || pb.email || '—';
    const business = log.businessName || pb.businessName || '—';
    const action   = formatAction(log.action);
    const target   = log.targetName || log.meta?.targetName || log.meta?.propertyName || '—';
    return `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td>${i + 1}</td>
      <td>
        <div class="actor-name">${actor}</div>
        <div class="actor-email">${pb.email || '—'}</div>
      </td>
      <td>${business}</td>
      <td><span class="badge">${action}</span></td>
      <td>${target}</td>
      <td>${fmt(log.createdAt)}</td>
    </tr>
  `;
  }).join('');

  const filterParts = [
    filterClient  ? `Client: ${filterClient}`   : '',
    filterAction  ? `Action: ${formatAction(filterAction)}` : '',
    filterDateFrom ? `From: ${filterDateFrom}`  : '',
    filterDateTo   ? `To: ${filterDateTo}`      : '',
    search.trim()  ? `Search: "${search.trim()}"` : '',
  ].filter(Boolean);
  const filterLabel = filterParts.length ? filterParts.join('  ·  ') : 'All activity logs';

  function formatAction(action = '') {
    return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Activity Logs Export — ${date}</title>
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

    .actor-name  { font-weight: 600; color: #111827; }
    .actor-email { font-size: 9.5px; color: #9ca3af; margin-top: 1px; }

    .badge {
      display: inline-block; padding: 2px 8px;
      border-radius: 4px; font-size: 9px; font-weight: 700;
      background: #f0fdf4; color: #16a34a;
    }

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
      <div class="header__title">Activity Logs Report</div>
    </div>
    <div class="header__meta">
      Exported: ${date}<br/>
      Generated by Admin
    </div>
  </div>

  <div class="summary">
    <span class="summary__pill">${filterLabel}</span>
    <span class="summary__count">${allLogs.length} ${allLogs.length === 1 ? 'Log' : 'Logs'}</span>
  </div>

  ${allLogs.length === 0
    ? '<div class="empty">No activity logs match the current filter.</div>'
    : `<table>
        <thead>
          <tr>
            <th>#</th>
            <th>Performed By</th>
            <th>Business</th>
            <th>Action</th>
            <th>Target</th>
            <th>Date &amp; Time</th>
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