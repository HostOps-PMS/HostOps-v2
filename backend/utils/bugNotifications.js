import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const REPORT_EMAIL = 'innovation@telexph.com';

const SEV_COLORS = {
  low:      '#22c55e',
  medium:   '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
};

const STATUS_LABELS = {
  open:        'Open',
  in_progress: 'In Progress',
  sent:        'Sent',
  resolved:    'Resolved',
  dismissed:   'Dismissed',
};

const CATEGORY_LABELS = {
  ui_ux:       'UI / UX',
  api_backend: 'API / Backend',
  performance: 'Performance',
  security:    'Security',
  data:        'Data Issue',
  other:       'Other',
};

function buildEmailHtml(report) {
  const sevLabel  = (report.severity || 'high').charAt(0).toUpperCase() + (report.severity || 'high').slice(1);
  const stLabel   = STATUS_LABELS[report.status]   || report.status;
  const catLabel  = CATEGORY_LABELS[report.category] || report.category || '—';
  const now       = new Date(report.createdAt).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

  const imageHtml = (report.images || []).map(img =>
    `<div style="display:inline-block;margin:4px"><img src="${img.url}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /></div>`
  ).join('');

  const stepsHtml = report.stepsToReproduce
    ? `<p style="margin:16px 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Steps to Reproduce:</p>
       <div style="font-size:14px;color:#111827;line-height:1.7;white-space:pre-wrap">${report.stepsToReproduce}</div>`
    : '';

  const envParts = [report.environment?.browser, report.environment?.os].filter(Boolean);
  const envHtml  = envParts.length
    ? `<p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Environment:</p>
       <p style="margin:0 0 16px;font-size:14px;color:#111827">${envParts.join(' / ')}</p>`
    : '';

  return `
    <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <div style="background:#0c1c14;padding:20px 24px">
        <div style="color:#26a676;font-size:16px;font-weight:700;margin-bottom:8px">HostOps Bug Report</div>
        <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:${SEV_COLORS[report.severity] || '#f97316'}">${sevLabel}</div>
        <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:#6b7280;margin-left:6px">${stLabel}</div>
        <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:#3b82f6;margin-left:6px">${catLabel}</div>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.5">Good day,<br><br>Please see the bug report details below.</p>
        <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:0 0 18px"/>
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Date/Time Submitted:</p>
        <p style="margin:0 0 16px;font-size:14px;color:#111827">${now}</p>
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Reported By:</p>
        <p style="margin:0 0 16px;font-size:14px;color:#111827">${report.name || '—'} &lt;${report.email}&gt;</p>
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Page / Module Affected:</p>
        <p style="margin:0 0 16px;font-size:14px;color:#111827">${report.page || '—'}</p>
        ${envHtml}
        <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:0 0 18px"/>
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px"><em>Bug Description:</em></p>
        <div style="font-size:14px;color:#111827;line-height:1.7">${report.description}</div>
        ${stepsHtml}
        ${imageHtml ? `<hr style="border:none;border-top:1.5px solid #e5e7eb;margin:18px 0"/><p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase">Attachments:</p>${imageHtml}` : ''}
        <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:20px 0 14px"/>
        <table style="width:100%;font-size:12px;color:#9ca3af"><tr>
          <td>Report ID: <span style="font-family:monospace">${report._id}</span></td>
          <td style="text-align:right">Submitted via HostOps Client Dashboard</td>
        </tr></table>
      </div>
    </div>
  `;
}

export async function sendBugReportEmail(report) {
  const sevLabel = (report.severity || 'high').charAt(0).toUpperCase() + (report.severity || 'high').slice(1);
  const { error } = await resend.emails.send({
    from:     'HostOps Bug Report <onboarding@resend.dev>',
    to:       REPORT_EMAIL,
    reply_to: report.email,
    subject:  `[BUG REPORT] [${sevLabel.toUpperCase()}] [HostOps] — ${report.page || 'General'}`,
    html:     buildEmailHtml(report),
  });
  if (error) throw new Error(error.message);
}

export async function sendWebhookNotification(report) {
  const url = process.env.INTERNAL_WEBHOOK_URL;
  if (!url) return;

  const sevLabel = (report.severity || 'high').charAt(0).toUpperCase() + (report.severity || 'high').slice(1);
  const catLabel = CATEGORY_LABELS[report.category] || report.category || 'Other';
  const images   = report.images || [];

  const payload = {
    // ── Event meta ──────────────────────────────────────────────
    event:            'bug_report.created',
    reportId:         report._id?.toString(),

    // ── Reporter ────────────────────────────────────────────────
    email:            report.email || '',
    name:             report.name  || '',

    // ── Bug details ─────────────────────────────────────────────
    page:             report.page             || '',
    severity:         report.severity         || 'medium',
    severityLabel:    sevLabel,
    category:         report.category         || 'other',
    categoryLabel:    catLabel,
    description:      report.description      || '',
    stepsToReproduce: report.stepsToReproduce || '',

    // ── Environment ─────────────────────────────────────────────
    environmentBrowser: report.environment?.browser || '',
    environmentOs:      report.environment?.os      || '',

    // ── Images ──────────────────────────────────────────────────
    imageCount:   images.length,
    imageUrls:    images.map(img => img.url),
    imagePublicIds: images.map(img => img.publicId),

    // ── Status ──────────────────────────────────────────────────
    status:       report.status       || 'open',
    resolvedNote: report.resolvedNote || '',
    resolvedAt:   report.resolvedAt   ? new Date(report.resolvedAt).toISOString() : '',
    resolvedBy:   report.resolvedBy   ? report.resolvedBy.toString() : '',

    // ── Timestamps ──────────────────────────────────────────────
    createdAt:    report.createdAt?.toISOString?.() || new Date().toISOString(),
    updatedAt:    report.updatedAt?.toISOString?.() || '',

    // ── Plain-text summary (GHL note / Slack / Teams) ───────────
    text: `[BUG REPORT] ${sevLabel.toUpperCase()} | ${catLabel} | ${report.page || 'General'}\nFrom: ${report.name || '—'} <${report.email}>\n\n${report.description}${report.stepsToReproduce ? `\n\nSteps:\n${report.stepsToReproduce}` : ''}`,
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`Webhook responded with HTTP ${res.status}`);
}
