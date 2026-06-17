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

    // Send email notification (non-blocking)
    const sevColors = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
    const sevLabel  = data.severity.charAt(0).toUpperCase() + data.severity.slice(1);

    resend.emails.send({
      from:    process.env.EMAIL_FROM || 'HostOps <onboarding@resend.dev>',
      to:      NOTIFY_EMAIL,
      subject: `[Bug Report] [${sevLabel}] ${data.description.slice(0, 80)}`,
      html: `
        <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
          <div style="background:#0c1c14;padding:20px 24px;display:flex;align-items:center;gap:12px">
            <div style="color:#26a676;font-size:18px;font-weight:700">🐛 Bug Report</div>
          </div>
          <div style="padding:24px">
            <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;background:${sevColors[data.severity]};margin-bottom:16px">${sevLabel}</div>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:8px 0;color:#6b7280;width:100px">From</td><td style="padding:8px 0;color:#111827;font-weight:500">${data.name || '—'} &lt;${data.email}&gt;</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Page</td><td style="padding:8px 0;color:#111827">${data.page || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Report ID</td><td style="padding:8px 0;color:#111827;font-family:monospace">${report._id}</td></tr>
            </table>
            <div style="margin-top:16px;padding:16px;background:#f8faf9;border:1px solid #e3ede8;border-radius:10px">
              <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600">Description</div>
              <div style="font-size:14px;color:#111827;line-height:1.6;white-space:pre-wrap">${data.description}</div>
            </div>
            <div style="margin-top:20px;font-size:12px;color:#9ca3af">Submitted ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT</div>
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
