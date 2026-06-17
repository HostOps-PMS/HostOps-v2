import express from 'express';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import BugReport from '../models/BugReport.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

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

// ═══════════════════════════════════════════════════════════════
// ADMIN ROUTER — requires auth + admin role
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
