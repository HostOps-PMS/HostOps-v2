import { Router } from 'express';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import Announcement from '../models/Announcement.js';

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

function parseTargetClients(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(id => mongoose.Types.ObjectId.isValid(id));
  } catch { return []; }
}

const router = Router();

// ── Client-facing: only published announcements visible to this user ──────────
router.get('/announcements/client', requireAuth, async (req, res, next) => {
  try {
    const now    = new Date();
    const userId = req.user._id;

    console.log('[announcements/client] userId:', userId, 'role:', req.user.role);

    // endDate is informational only — admin archives to end visibility.
    // startDate controls "not yet visible" (hide until start date arrives).
    const announcements = await Announcement.find({
      status: 'published',
      $and: [
        {
          $or: [
            { audience: 'all' },
            { audience: 'selected', targetClients: userId },
          ],
        },
        {
          $or: [
            { startDate: null },
            { startDate: { $exists: false } },
            { startDate: { $lte: now } },
          ],
        },
      ],
    })
      .select('title content image priority publishedAt')
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(50)
      .lean();

    console.log('[announcements/client] found:', announcements.length);
    res.json(announcements);
  } catch (err) { next(err); }
});

router.get('/announcements', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .populate('targetClients', 'businessName email')
      .lean();
    res.json(announcements);
  } catch (err) { next(err); }
});

router.get('/announcements/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }
    const announcement = await Announcement.findById(req.params.id)
      .populate('targetClients', 'businessName email')
      .lean();
    if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
    res.json(announcement);
  } catch (err) { next(err); }
});

router.post('/announcements', requireAuth, requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const { title, content, audience, priority, status, startDate, endDate, targetClients } = req.body;
      if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

      let image = { url: '', publicId: '' };
      if (req.file) {
        try {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'hostops/announcements',
            resource_type: 'image',
          });
          image = { url: result.secure_url, publicId: result.public_id };
        } finally {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }
      }

      const doc = await Announcement.create({
        title,
        content,
        image,
        audience:      audience  || 'all',
        targetClients: audience === 'selected' ? parseTargetClients(targetClients) : [],
        priority:      priority  || 'normal',
        status:        status    || 'draft',
        startDate:     startDate || null,
        endDate:       endDate   || null,
        publishedAt:   status === 'published' ? new Date() : null,
        createdBy: {
          userId:    req.user._id,
          email:     req.user.email,
          firstName: req.user.firstName || req.user.businessName || '',
        },
      });

      const populated = await doc.populate('targetClients', 'businessName email');
      res.status(201).json(populated);
    } catch (err) { next(err); }
  });
});

router.patch('/announcements/:id', requireAuth, requireAdmin, (req, res, next) => {
  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid announcement ID' });
      }

      const { title, content, audience, priority, status, startDate, endDate, targetClients, removeImage } = req.body;
      const update = {};
      if (title     !== undefined) update.title    = title;
      if (content   !== undefined) update.content  = content;
      if (priority  !== undefined) update.priority  = priority;
      if (startDate !== undefined) update.startDate = startDate || null;
      if (endDate   !== undefined) update.endDate   = endDate   || null;
      if (audience  !== undefined) {
        update.audience = audience;
        update.targetClients = audience === 'selected' ? parseTargetClients(targetClients) : [];
      }
      if (status !== undefined) {
        update.status = status;
        if (status === 'published') update.publishedAt = new Date();
      }

      if (req.file) {
        const existing = await Announcement.findById(req.params.id).select('image').lean();
        if (existing?.image?.publicId) {
          await cloudinary.uploader.destroy(existing.image.publicId).catch(() => {});
        }
        try {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'hostops/announcements',
            resource_type: 'image',
          });
          update.image = { url: result.secure_url, publicId: result.public_id };
        } finally {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }
      } else if (removeImage === 'true') {
        const existing = await Announcement.findById(req.params.id).select('image').lean();
        if (existing?.image?.publicId) {
          await cloudinary.uploader.destroy(existing.image.publicId).catch(() => {});
        }
        update.image = { url: '', publicId: '' };
      }

      const doc = await Announcement.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true })
        .populate('targetClients', 'businessName email');
      if (!doc) return res.status(404).json({ error: 'Announcement not found' });
      res.json(doc);
    } catch (err) { next(err); }
  });
});

router.delete('/announcements/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }
    const doc = await Announcement.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Announcement not found' });
    if (doc.image?.publicId) {
      await cloudinary.uploader.destroy(doc.image.publicId).catch(() => {});
    }
    res.json({ message: 'Announcement deleted' });
  } catch (err) { next(err); }
});

export default router;
