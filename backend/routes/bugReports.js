import express from 'express';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import nodemailer from 'nodemailer';
import BugReport from '../models/BugReport.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const REPORT_EMAIL = 'cjcoloma02@gmail.com';
const gmailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: REPORT_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD || 'lmyy fikh ukfs sxnn',
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  },
});

// ═══════════════════════════════════════════════════════════════
// PUBLIC ROUTER — no auth required (clients submit from footer)
// ═══════════════════════════════════════════════════════════════
export const publicBugReportRouter = express.Router();

publicBugReportRouter.post('/bug-report', (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (err) {
      console.error('[BugReport] Multer error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    handleBugReport(req, res, next);
  });
});

async function handleBugReport(req, res, next) {
  try {
    console.log('[BugReport] Body:', JSON.stringify(req.body));
    const data = z.object({
      email:       z.string().email().max(254).trim(),
      name:        z.string().max(100).trim().optional().default(''),
      page:        z.string().max(200).trim().optional().default(''),
      severity:    z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
      description: z.string().min(10).max(2000).trim(),
    }).parse(req.body);

    const uploaded = [];
    if (req.files?.length) {
      for (const file of req.files) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'hostops/bug-reports',
            resource_type: 'image',
          });
          uploaded.push({ url: result.secure_url, publicId: result.public_id });
        } catch (err) {
          console.warn('[BugReport] Image upload failed:', err.message);
        } finally {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }
      }
    }

    await BugReport.create({
      email:       data.email.toLowerCase(),
      name:        data.name,
      page:        data.page,
      severity:    data.severity,
      description: data.description,
      images:      uploaded,
      status:      'open',
    });

    return res.status(201).json({ message: 'Bug report submitted successfully.' });
  } catch (err) {
    if (req.files) req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch {} });
    if (err.name === 'ZodError') {
      console.error('[BugReport] Zod errors:', JSON.stringify(err.errors));
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
}

// Client checks their own reports by email (no auth needed — they only see status of their own submissions)
publicBugReportRouter.get('/my-reports', async (req, res, next) => {
  try {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.json([]);
    const reports = await BugReport.find({ email })
      .select('page severity description status resolvedNote createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json(reports);
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTER — requires auth + admin role
// ═══════════════════════════════════════════════════════════════
export const adminBugReportRouter = express.Router();

// Client fetches their own reports (any authenticated user)
adminBugReportRouter.get('/my-bug-reports', requireAuth, async (req, res, next) => {
  try {
    const reports = await BugReport.find({ email: req.user.email.toLowerCase() })
      .sort({ createdAt: -1 }).lean();
    res.json(reports);
  } catch (err) { next(err); }
});

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

adminBugReportRouter.post('/bug-reports/:id/send-email', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const report = await BugReport.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ error: 'Bug report not found' });

    const sevColors = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
    const sevLabel  = (report.severity || 'high').charAt(0).toUpperCase() + (report.severity || 'high').slice(1);
    const now       = new Date(report.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    const stLabel   = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', dismissed: 'Dismissed' }[report.status] || report.status;

    const imageHtml = (report.images || []).map(img =>
      `<div style="display:inline-block;margin:4px"><img src="${img.url}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" /></div>`
    ).join('');

    await gmailTransport.sendMail({
      from:    `HostOps Bug Report <${REPORT_EMAIL}>`,
      to:      REPORT_EMAIL,
      subject: `[BUG REPORT] [${sevLabel.toUpperCase()}] ${report.page || 'General'} — ${(report.description || '').replace(/<[^>]*>/g, '').slice(0, 60)}`,
      html: `
        <div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
          <div style="background:#0c1c14;padding:20px 24px">
            <div style="color:#26a676;font-size:16px;font-weight:700;margin-bottom:4px">HostOps Bug Report</div>
            <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:${sevColors[report.severity] || '#f97316'}">${sevLabel}</div>
            <div style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;background:#6b7280;margin-left:6px">${stLabel}</div>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.5">Good day,<br><br>Please see the bug report details below.</p>
            <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:0 0 18px"/>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Date/Time Discovered:</p>
            <p style="margin:0 0 16px;font-size:14px;color:#111827">${now}</p>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Reported By:</p>
            <p style="margin:0 0 16px;font-size:14px;color:#111827">${report.name || '—'} &lt;${report.email}&gt;</p>
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Page/Module Affected:</p>
            <p style="margin:0 0 16px;font-size:14px;color:#111827">${report.page || '—'}</p>
            <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:0 0 18px"/>
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px"><em>Bug Description:</em></p>
            <div style="font-size:14px;color:#111827;line-height:1.7">${report.description}</div>
            ${imageHtml ? `<hr style="border:none;border-top:1.5px solid #e5e7eb;margin:18px 0"/><p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase">Attachments:</p>${imageHtml}` : ''}
            <hr style="border:none;border-top:1.5px solid #e5e7eb;margin:20px 0 14px"/>
            <table style="width:100%;font-size:12px;color:#9ca3af"><tr>
              <td>Report ID: <span style="font-family:monospace">${report._id}</span></td>
              <td style="text-align:right">Submitted via HostOps Client Dashboard</td>
            </tr></table>
          </div>
        </div>
      `,
    });

    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('[BugReport] Send email failed:', err.message);
    next(err);
  }
});
