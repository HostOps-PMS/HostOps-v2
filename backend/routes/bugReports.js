import express from 'express';
import { z } from 'zod';
import { Resend } from 'resend';
import BugReport from '../models/BugReport.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const NOTIFY_EMAIL = 'innovation@telexph.com';

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTER — no auth required (clients submit from footer)
// Mount as: app.use('/auth', publicBugReportRouter)
// Final path: POST /auth/bug-report
// ═══════════════════════════════════════════════════════════════
export const publicBugReportRouter = express.Router();

const submitSchema = z.object({
  email:       z.string().email().max(254).trim(),
  name:        z.string().max(100).trim().optional().default(''),
  page:        z.string().max(200).trim().optional().default(''),
  severity:    z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  description: z.string()
               .min(10, 'Please provide at least 10 characters describing the bug.')
               .max(2000)
               .trim(),
});

publicBugReportRouter.post('/bug-report', async (req, res, next) => {
  try {
    const data = submitSchema.parse(req.body);

    const report = await BugReport.create({
      email:       data.email.toLowerCase(),
      name:        data.name,
      page:        data.page,
      severity:    data.severity,
      description: data.description,
      status:      'open',
    });

    const sevColors = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
    const sevLabel  = data.severity.charAt(0).toUpperCase() + data.severity.slice(1);
    const now       = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const descHtml  = data.description.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');

    resend.emails.send({
      from:    process.env.EMAIL_FROM || 'HostOps <onboarding@resend.dev>',
      to:      NOTIFY_EMAIL,
      subject: `[BUG REPORT] [${sevLabel.toUpperCase()}] ${data.page || 'General'} — ${data.description.slice(0, 60)}`,
      html: `
        <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
          <div style="background:#0c1c14;padding:20px 24px">
            <div style="color:#26a676;font-size:16px;font-weight:700;margin-bottom:4px">🐛 HostOps Bug Report</div>
            <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:${sevColors[data.severity]}">${sevLabel}</div>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.5">Please see the bug report details below.</p>

            <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:0 0 18px"/>

            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Date/Time Discovered:</p>
            <p style="margin:0 0 16px;font-size:14px;color:#111827">${now}</p>

            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Reported By:</p>
            <p style="margin:0 0 16px;font-size:14px;color:#111827">${data.name || '—'} &lt;${data.email}&gt;</p>

            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Page/Module Affected:</p>
            <p style="margin:0 0 16px;font-size:14px;color:#111827">${data.page || '—'}</p>

            <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:0 0 18px"/>

            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px"><em>Bug Description:</em></p>
            <div style="font-size:14px;color:#111827;line-height:1.7">${descHtml}</div>

            <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:20px 0 14px"/>
            <table style="width:100%;font-size:12px;color:#9ca3af">
              <tr>
                <td>Report ID: <span style="font-family:monospace">${report._id}</span></td>
                <td style="text-align:right">Submitted via HostOps Client Dashboard</td>
              </tr>
            </table>
          </div>
        </div>
      `,
    }).catch(err => console.warn('[BugReport] Email notification failed:', err.message));

    return res.status(201).json({ message: 'Bug report submitted successfully.' });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTER — requires auth + admin role
// Mount as: app.use('/api', adminBugReportRouter)
// ═══════════════════════════════════════════════════════════════
export const adminBugReportRouter = express.Router();

adminBugReportRouter.get('/bug-reports', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, severity } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (severity) filter.severity = severity;
    const reports = await BugReport.find(filter).sort({ createdAt: -1 }).lean();
    res.json(reports);
  } catch (err) { next(err); }
});

adminBugReportRouter.patch('/bug-reports/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, resolvedNote } = req.body;
    const update = { status };
    if (status === 'resolved' || status === 'dismissed') {
      update.resolvedAt   = new Date();
      update.resolvedBy   = req.user._id;
      update.resolvedNote = resolvedNote || '';
    }
    const report = await BugReport.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!report) return res.status(404).json({ error: 'Bug report not found' });
    res.json(report);
  } catch (err) { next(err); }
});
