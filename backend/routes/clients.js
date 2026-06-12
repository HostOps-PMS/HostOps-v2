// src/routes/clients.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for managing platform clients (users).
// Mount in server.js: app.use('/api', clientsRoutes);
//
// Properties are now embedded directly in the User document as
// user.properties[]. There is no separate Property collection.
// smoobuApiKey lives inside each embedded property (select:false).
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z } from 'zod';
import User from '../models/user.js';
import { requireAuth, requireAdmin, requireAdminOrTeamLeader } from '../middleware/auth.js';
import { getDashboard } from '../services/smoobu.js';
import { v2 as cloudinary } from 'cloudinary';
import { invalidateImageCache } from './imageProxy.js';
import multer from 'multer';
import fs from 'fs';
import os from 'os';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for temp storage
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────────
// GET /api/clients
// Returns registered users.
// Admins see all users.
// Team leaders only see their own assigned client (serverId).
// ─────────────────────────────────────────────────────────────────
router.get('/clients', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    const showArchived = req.query.archived === 'true';

    const filter = req.user.role === 'team_leader'
      ? { _id: req.user.serverId }
      : { isArchive: showArchived ? true : { $ne: true } };

    const clients = await User.find(filter)
      .select('-password -verifyToken -verifyTokenExpiry -resetToken -resetTokenExpiry -__v')
      .sort({ createdAt: -1 })
      .lean();

    res.json(clients);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/clients/:id
// Returns a single client by MongoDB ObjectId.
// ─────────────────────────────────────────────────────────────────
router.get('/clients/:id', requireAdmin, async (req, res, next) => {
  try {
    const client = await User.findById(req.params.id)
      .select('-password -verifyToken -verifyTokenExpiry -resetToken -resetTokenExpiry -__v')
      .lean();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/clients/:id/smoobu
// Admin views Smoobu dashboard data for one of a client's properties.
//
// Required query param: ?propertyId=<embedded property _id>
//
// The property's smoobuApiKey is loaded server-side (+properties.smoobuApiKey)
// and is NEVER sent to the frontend — the server fetches Smoobu on
// behalf of the property and returns only the dashboard payload.
//
// If the property has no key, returns { smoobuNotConnected: true }.
// ─────────────────────────────────────────────────────────────────
router.get('/clients/:id/smoobu', requireAdmin, async (req, res, next) => {
  try {
    const { propertyId } = req.query;

    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId query param is required.' });
    }

    // Load user WITH smoobuApiKey on embedded properties
    const user = await User.findById(req.params.id).select('+properties.smoobuApiKey');
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const property = user.properties.id(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found for this client.' });
    }

    if (!property.smoobuApiKey || !property.smoobuApiKey.trim()) {
      return res.status(200).json({
        smoobuNotConnected: true,
        message: 'This property has no Smoobu API key configured.',
      });
    }

    // getDashboard expects a user-like object with smoobuApiKey and propertyTagPrefix.
    const smoobuContext = {
      smoobuApiKey:      property.smoobuApiKey,
      propertyTagPrefix: user.propertyTagPrefix || '',
    };

    const data = await getDashboard(smoobuContext, {
      from: req.query.from,
      to:   req.query.to,
    });

    res.json(data);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    if (err.code === 'NO_SMOOBU_KEY') {
      return res.status(200).json({
        smoobuNotConnected: true,
        message: err.message,
      });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/clients/:id/properties
// Returns all embedded properties of a client.
// smoobuApiKey is excluded from the response.
// ─────────────────────────────────────────────────────────────────
router.get('/clients/:id/properties', requireAdmin, async (req, res, next) => {
  try {
    const userDoc = await User.findById(req.params.id).select('+properties.smoobuApiKey');
    if (!userDoc) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const user = userDoc.toObject({ getters: true });

    // Strip smoobuApiKey from each property before sending, but provide a boolean flag and masked key
    const safe = (user.properties || []).map(({ smoobuApiKey, ...rest }) => {
      const hasKey = !!(smoobuApiKey && smoobuApiKey.trim());
      let maskedKey = '';
      if (hasKey) {
        const keyStr = smoobuApiKey.trim();
        if (keyStr.length > 4) {
          maskedKey = '•'.repeat(keyStr.length - 4) + keyStr.slice(-4);
        } else {
          maskedKey = '•'.repeat(keyStr.length);
        }
      }
      return {
        ...rest,
        hasSmoobuKey: hasKey,
        maskedSmoobuApiKey: maskedKey,
        propertyPicture: rest.propertyPicture || '',
        propertyPictureOriginal: rest.propertyPictureOriginal || '',
        propertyPictureCropData: rest.propertyPictureCropData || null
      };
    });
    res.json(safe);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/clients/:id/properties/:propertyId/apikey
// Admin fetches the unmasked API key for a property.
// Should be protected by frontend OTP verification.
// ─────────────────────────────────────────────────────────────────
router.get('/clients/:id/properties/:propertyId/apikey', requireAdmin, async (req, res, next) => {
  try {
    const userDoc = await User.findById(req.params.id).select('+properties.smoobuApiKey');
    if (!userDoc) {
      return res.status(404).json({ error: 'Client not found' });
    }
    const user = userDoc.toObject({ getters: true });

    const property = (user.properties || []).find(p => p._id.toString() === req.params.propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found for this client.' });
    }

    res.json({ smoobuApiKey: property.smoobuApiKey || '' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/clients/:id/properties
// Admin adds an embedded property to a client's properties array.
// ─────────────────────────────────────────────────────────────────
const createPropertySchema = z.object({
  propertyName: z.string().min(1).max(150).trim(),
  smoobuApiKey: z.string().max(512).optional().default(''),
});

router.post('/clients/:id/properties', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const data = createPropertySchema.parse(req.body);

    user.properties.push({
      propertyName: data.propertyName,
      smoobuApiKey: data.smoobuApiKey.trim() || '',
    });

    await user.save();

    // Return the newly added property without smoobuApiKey
    const added = user.properties[user.properties.length - 1].toObject();
    const { smoobuApiKey: _, ...safe } = added;
    res.status(201).json(safe);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/clients/:id/properties/:propertyId
// Admin updates an embedded property's name or smoobuApiKey.
// ─────────────────────────────────────────────────────────────────
const updatePropertySchema = z.object({
  propertyName: z.string().min(1).max(150).trim().optional(),
  smoobuApiKey: z.string().max(512).optional(),
});

router.patch('/clients/:id/properties/:propertyId', requireAdmin, async (req, res, next) => {
  try {
    const data = updatePropertySchema.parse(req.body);

    const user = await User.findById(req.params.id).select('+properties.smoobuApiKey');
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const property = user.properties.id(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found for this client.' });
    }

    if (data.propertyName !== undefined) property.propertyName = data.propertyName;
    if (data.smoobuApiKey !== undefined) property.smoobuApiKey = data.smoobuApiKey.trim();

    await user.save();

    const { smoobuApiKey: _, ...safe } = property.toObject();
    res.json(safe);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/clients/:id/properties/:propertyId/picture
// Admin uploads a property picture
// ─────────────────────────────────────────────────────────────────
router.post('/clients/:id/properties/:propertyId/picture', requireAdmin, upload.single('picture'), async (req, res, next) => {
  try {
    const cropDataRaw = req.body.cropData;
    let cropData = null;
    if (cropDataRaw) {
      try { cropData = JSON.parse(cropDataRaw); } catch (e) { /* ignore */ }
    }

    if (!req.file && !cropData) {
      return res.status(400).json({ error: 'No picture file or crop data provided.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Client not found' });
    }

    const property = user.properties.id(req.params.propertyId);
    if (!property) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Property not found for this client.' });
    }

    if (!req.file && !property.propertyPictureOriginal) {
       return res.status(400).json({ error: 'No existing picture to adjust.' });
    }

    const propertyName = property.propertyName || property.name || 'property';
    const fileName = propertyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const publicId = `${fileName}_${user._id}_${property._id}`;
    let originalUrl = property.propertyPictureOriginal;

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "hostops/properties-pictures",
        public_id: publicId,
        overwrite: true,
      });

      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      originalUrl = result.secure_url;
      property.propertyPictureOriginal = originalUrl;
    }

    let finalPictureUrl = originalUrl;

    if (cropData && cropData.croppedAreaPixels) {
      property.propertyPictureCropData = cropData;
      const p = cropData.croppedAreaPixels;
      
      finalPictureUrl = cloudinary.url(`hostops/properties-pictures/${publicId}`, {
        secure: true,
        crop: 'crop',
        x: Math.round(p.x),
        y: Math.round(p.y),
        width: Math.round(p.width),
        height: Math.round(p.height),
        version: Date.now() // Bypass caching
      });
    }

    property.propertyPicture = finalPictureUrl;
    await user.save();

    // Bust the image proxy cache so the new picture is served immediately
    invalidateImageCache(String(user._id), String(property._id));

    res.json({ 
      message: 'Property picture updated successfully.',
      // Return proxy URL — never expose raw Cloudinary URL to client
      propertyPicture:         `/api/image/property/${user._id}/${property._id}`,
      propertyPictureOriginal: property.propertyPictureOriginal,
      propertyPictureCropData: property.propertyPictureCropData
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('[picture-upload] Error:', err.message || err);
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    if (err.http_code || err.message?.includes('cloudinary')) {
      return res.status(502).json({ error: 'Image service error: ' + (err.message || 'Unknown') });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/clients/:id/properties/:propertyId/sync
// Syncs subProperties (rooms/units) from Smoobu for a given property.
// Fetches the apartment list from Smoobu using the property's key
// and upserts them into property.subProperties.
// NOTE: subProperties are stored on the embedded property object.
// ─────────────────────────────────────────────────────────────────
router.post('/clients/:id/properties/:propertyId/sync', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+properties.smoobuApiKey');
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const property = user.properties.id(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found for this client.' });
    }

    if (!property.smoobuApiKey || !property.smoobuApiKey.trim()) {
      return res.status(400).json({ error: 'This property has no Smoobu API key configured.' });
    }

    // Fetch apartment list from Smoobu
    const smoobuRes = await fetch('https://login.smoobu.com/api/apartments', {
      headers: {
        'Api-Key':       property.smoobuApiKey,
        'Cache-Control': 'no-cache',
      },
    });

    if (!smoobuRes.ok) {
      const body = await smoobuRes.json().catch(() => ({}));
      return res.status(502).json({
        error: 'Smoobu API error',
        details: body?.message ?? `HTTP ${smoobuRes.status}`,
      });
    }

    const smoobuData = await smoobuRes.json();
    const apartments = Array.isArray(smoobuData)
      ? smoobuData
      : (smoobuData.apartments ?? []);

    const synced = apartments.map((apt) => ({
      smoobuId:     apt.id,
      name:         apt.name ?? apt.title ?? `Room ${apt.id}`,
      type:         apt.type ?? '',
      smoobuData:   apt,
      lastSyncedAt: new Date(),
    }));

    property.subProperties = synced;
    property.lastSyncedAt  = new Date();
    await user.save();

    res.json({
      message:  `Synced ${synced.length} sub-properties from Smoobu.`,
      count:    synced.length,
      subProperties: synced.map(({ smoobuData: _sd, ...rest }) => rest),
    });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/clients/:id/properties/:propertyId
// Admin removes an embedded property from the client's properties array.
// ─────────────────────────────────────────────────────────────────
router.delete('/clients/:id/properties/:propertyId', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const property = user.properties.id(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found for this client.' });
    }

    property.deleteOne();
    await user.save();

    res.json({ message: 'Property removed successfully.' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/clients
// Admin creates a new user account with embedded properties.
// isVerified is set to true — admin-created accounts are pre-verified.
// ─────────────────────────────────────────────────────────────────
const createClientSchema = z.object({
  businessName:      z.string().min(1).max(150).trim(),
  email:             z.string().email().max(254),
  password:          z.string().min(8).max(128),
  pin:               z.string().length(6, "PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must contain only numbers"),
  role:              z.enum(['client', 'admin', 'team_leader']).optional().default('client'),
  propertyTagPrefix: z.string().max(100).trim().optional().default(''),
  serverId:          z.string().optional(),
  properties: z.array(z.object({
    propertyName: z.string().min(1).max(150).trim(),
    smoobuApiKey: z.string().max(512).optional().default(''),
  })).optional().default([]),
});

router.post('/clients', requireAdmin, async (req, res, next) => {
  try {
    const data = createClientSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    if (data.role === 'team_leader') {
      if (!data.serverId) {
        return res.status(400).json({ error: 'Server assignment is required for Team Leaders.' });
      }
      const serverUser = await User.findOne({ _id: data.serverId, role: 'client' });
      if (!serverUser) {
        return res.status(400).json({ error: 'Invalid server selected. Must be an existing client.' });
      }
    }

    const user = await User.create({
      businessName:       data.businessName,
      email:              data.email.toLowerCase(),
      password:           data.password,
      pin:                data.pin,
      role:               data.role,
      propertyTagPrefix:  data.propertyTagPrefix || '',
      serverId:           data.serverId || null,
      isVerified:         true,
      mustChangePassword: true,
      mustChangePin:      true,
      properties:         data.properties.map((p) => ({
        propertyName: p.propertyName,
        smoobuApiKey: p.smoobuApiKey.trim() || '',
      })),
    });

    res.status(201).json({
      message: 'Account created successfully.',
      userId:  user._id,
      user:    user.toJSON(),
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/clients/:id
// Admin updates a client's editable fields.
// ─────────────────────────────────────────────────────────────────
const updateClientSchema = z.object({
  businessName:      z.string().min(1).max(150).trim().optional(),
  serverId:          z.string().optional(),
  role:              z.enum(['client', 'admin', 'team_leader']).optional(),
  propertyTagPrefix: z.string().max(100).trim().optional(),
  password:          z.string().min(8).max(128).optional(),
  pin:               z.string().length(6, "PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must contain only numbers").optional(),
});

router.patch('/clients/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = updateClientSchema.parse(req.body);

    const client = await User.findById(req.params.id).select('+pin +password');
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Assign fields directly (not via .set()) so Mongoose reliably marks
    // them as modified — critical for the pre-save bcrypt hooks to fire
    // correctly for password and pin.
    if (data.businessName      !== undefined) client.businessName      = data.businessName;
    if (data.serverId          !== undefined) client.serverId          = data.serverId || null;
    if (data.role              !== undefined) client.role              = data.role;
    if (data.propertyTagPrefix !== undefined) client.propertyTagPrefix = data.propertyTagPrefix;
    if (data.password          !== undefined) {
      client.password           = data.password;
      client.mustChangePassword = true;
    }
    if (data.pin               !== undefined) {
      client.pin                = data.pin;
      client.mustChangePin      = true;
    }

    await client.save();

    const savedClient = client.toJSON();
    res.json(savedClient);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/clients/:id/archive
// Admin soft-archives a client (isArchive = true).
// ─────────────────────────────────────────────────────────────────
router.patch('/clients/:id/archive', requireAdmin, async (req, res, next) => {
  try {
    const client = await User.findByIdAndUpdate(
      req.params.id,
      { isArchive: true },
      { new: true }
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client archived.', client: client.toJSON() });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid client ID' });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/clients/:id/unarchive
// Admin restores a client from archive (isArchive = false).
// ─────────────────────────────────────────────────────────────────
router.patch('/clients/:id/unarchive', requireAdmin, async (req, res, next) => {
  try {
    const client = await User.findByIdAndUpdate(
      req.params.id,
      { isArchive: false },
      { new: true }
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client unarchived.', client: client.toJSON() });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid client ID' });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/clients/:id
// Admin deletes a client or team leader account.
// ─────────────────────────────────────────────────────────────────
router.delete('/clients/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Client not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

export default router;