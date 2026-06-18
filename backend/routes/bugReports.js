import express from 'express';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import BugReport from '../models/BugReport.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sendBugReportEmail, sendWebhookNotification, sendReplyEmail } from '../utils/bugNotifications.js';

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
      email:            z.string().email().max(254).trim(),
      name:             z.string().max(100).trim().optional().default(''),
      page:             z.string().max(200).trim().optional().default(''),
      severity:         z.enum(['low', 'medium', 'high', 'critical']).optional().default('high'),
      category:         z.enum(['ui_ux', 'api_backend', 'performance', 'security', 'data', 'other']).optional().default('other'),
      description:      z.string().min(10).max(2000).trim(),
      stepsToReproduce: z.string().max(2000).trim().optional().default(''),
      environment: z.object({
        browser: z.string().max(200).trim().optional().default(''),
        os:      z.string().max(200).trim().optional().default(''),
      }).optional().default({}),
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

    const report = await BugReport.create({
      email:            data.email.toLowerCase(),
      name:             data.name,
      page:             data.page,
      severity:         data.severity,
      category:         data.category,
      description:      data.description,
      stepsToReproduce: data.stepsToReproduce,
      environment:      data.environment,
      images:           uploaded,
      status:           'open',
    });

    // Respond immediately — notifications fire in the background
    res.status(201).json({ message: 'Bug report submitted successfully.' });

    Promise.allSettled([
      sendBugReportEmail(report),
      sendWebhookNotification(report),
    ]).then(results => {
      const labels = ['email', 'webhook'];
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`[BugReport] ${labels[i]} notification failed:`, r.reason?.message);
        } else {
          console.log(`[BugReport] ${labels[i]} notification sent`);
        }
      });
    });
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
      .select('page severity category description status resolvedNote createdAt')
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
    const { status, severity, category } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (severity) filter.severity = severity;
    if (category) filter.category = category;
    const reports = await BugReport.find(filter).sort({ createdAt: -1 }).lean();
    res.json(reports);
  } catch (err) { next(err); }
});

adminBugReportRouter.patch('/bug-reports/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status, resolvedNote } = req.body;
    const update = { status };
    if (status === 'resolved' || status === 'dismissed' || status === 'sent') {
      update.resolvedAt   = new Date();
      update.resolvedBy   = req.user._id;
      update.resolvedNote = resolvedNote || '';
    }
    const report = await BugReport.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!report) return res.status(404).json({ error: 'Bug report not found' });
    res.json(report);
  } catch (err) { next(err); }
});

// Admin reply to client
adminBugReportRouter.post('/bug-reports/:id/reply', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });

    const report = await BugReport.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Bug report not found' });

    const reply = {
      message:    message.trim(),
      sentAt:     new Date(),
      sentByName: req.user?.name || req.user?.email || 'Admin',
      emailedToClient: false,
    };

    try {
      await sendReplyEmail(report, reply.message, reply.sentByName);
      reply.emailedToClient = true;
    } catch (err) {
      console.error('[BugReport] Reply email failed:', err.message);
    }

    report.adminReplies.push(reply);
    await report.save();

    res.json(report);
  } catch (err) { next(err); }
});

// Manual re-send by admin — uses the same shared email utility
adminBugReportRouter.post('/bug-reports/:id/send-email', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const report = await BugReport.findById(req.params.id).lean();
    if (!report) return res.status(404).json({ error: 'Bug report not found' });

    await sendBugReportEmail(report);

    console.log('[BugReport] Manual email sent for report:', report._id);
    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('[BugReport] Send email failed:', err.message);
    next(err);
  }
});
