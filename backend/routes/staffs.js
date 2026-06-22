// src/routes/staffs.js
// ─────────────────────────────────────────────────────────────────
// Admin-only routes for managing staff accounts per client.
// Each staff member is linked to a clientId and a list of
// Smoobu property IDs they are allowed to access.
//
// Mount in server.js: app.use('/api', staffsRoutes);
// ─────────────────────────────────────────────────────────────────
import express from 'express';
import { z } from 'zod';
import Staff from '../models/staff.js';
import User  from '../models/user.js';
import { requireAuth, requireAdminOrTeamLeader } from '../middleware/auth.js';
import { validateObjectId, logSuspiciousAccess } from '../middleware/ownershipGuard.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

router.get('/clients/:clientId/staff-properties', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    if (req.user.role === 'team_leader' && String(req.params.clientId) !== String(req.user.serverId)) {
      return res.status(403).json({ error: 'Unauthorized to access these properties' });
    }

    const user = await User.findById(req.params.clientId).select('properties');
    if (!user) return res.status(404).json({ error: 'Client not found' });

    // Return the embedded properties from database
    const properties = (user.properties || []).map((prop) => ({
      id: prop._id.toString(),
      propertyName: prop.propertyName,
    }));

    res.json({ properties });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/staffs
// Returns all staff members.
// Optional query: ?clientId=<mongoId> — filter by client.
// ─────────────────────────────────────────────────────────────────
router.get('/staffs', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    const showArchived = req.query.archived === 'true';
    const filter = { isArchive: showArchived ? true : { $ne: true } };

    if (req.user.role === 'team_leader') {
      filter.clientId = req.user.serverId;
    } else if (req.query.clientId) {
      filter.clientId = req.query.clientId;
    }

    const staffs = await Staff.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json(staffs);
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/staffs/:id
// Returns a single staff member by MongoDB ObjectId.
// ─────────────────────────────────────────────────────────────────
router.get('/staffs/:id', requireAdminOrTeamLeader, validateObjectId('id'), logSuspiciousAccess, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id).lean();
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    if (req.user.role === 'team_leader' && String(staff.clientId) !== String(req.user.serverId)) {
      return res.status(403).json({ error: 'Unauthorized to view this staff member' });
    }
    
    res.json(staff);
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// POST /api/staffs
// Admin creates a new staff account linked to a client.
// Staff accounts use PIN authentication (not password) for the
// dashboard. mustChangePin is set to true so the staff member is
// forced to set their own PIN on first login.
// ─────────────────────────────────────────────────────────────────
const createStaffSchema = z.object({
  clientId:    z.string().min(1),
  firstName:   z.string().min(1).max(50).trim(),
  lastName:    z.string().max(50).trim().optional().default(''),
  email:       z.string().email().max(254),
  pin:         z.string().length(6, "PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must contain only numbers"),
  propertyIds: z.array(z.string()).optional().default([]),
  staffRole:   z.string().max(100).trim().optional().default(''),
});

router.post('/staffs', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    const data = createStaffSchema.parse(req.body);

    if (req.user.role === 'team_leader' && String(data.clientId) !== String(req.user.serverId)) {
      return res.status(403).json({ error: 'Unauthorized to create staff for this client' });
    }

    // Verify the client exists
    const client = await User.findById(data.clientId);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const existing = await Staff.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const staff = await Staff.create({
      clientId:           data.clientId,
      firstName:          data.firstName,
      lastName:           data.lastName || '',
      email:              data.email.toLowerCase(),
      pin:                data.pin,
      propertyIds:        data.propertyIds,
      staffRole:          data.staffRole || '',
      isActive:           true,
      mustChangePin:      true,
    });

    const credentialsWebhookUrl = process.env.GHL_CREDENTIALS_WEBHOOK_URL;
    if (credentialsWebhookUrl) {
      try {
        await fetch(credentialsWebhookUrl, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            business_name: client.businessName,
            first_name:    data.firstName,
            last_name:     data.lastName || '',
            email:         data.email.toLowerCase(),
            temporary_pin: data.pin,
          }),
        });
      } catch (err) {
        console.error('Failed to trigger GHL credentials webhook:', err);
      }
    }

    res.status(201).json({
      message: 'Staff account created successfully.',
      staffId: staff._id,
      staff: staff.toJSON(),
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/staffs/:id
// Admin updates a staff member's editable fields.
// ─────────────────────────────────────────────────────────────────
const updateStaffSchema = z.object({
  firstName:   z.string().min(1).max(50).trim().optional(),
  lastName:    z.string().max(50).trim().optional(),
  propertyIds: z.array(z.string()).optional(),
  staffRole:   z.string().max(100).trim().optional(),
  isActive:    z.boolean().optional(),
  pin:         z.string().length(6, "PIN must be exactly 6 digits").regex(/^\d+$/, "PIN must contain only numbers").optional(),
});

router.patch('/staffs/:id', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    const data = updateStaffSchema.parse(req.body);

    const staff = await Staff.findById(req.params.id).select('+password +pin');
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    if (req.user.role === 'team_leader' && String(staff.clientId) !== String(req.user.serverId)) {
      return res.status(403).json({ error: 'Unauthorized to update this staff member' });
    }

    if (data.firstName   !== undefined) staff.firstName   = data.firstName;
    if (data.lastName    !== undefined) staff.lastName    = data.lastName;
    if (data.propertyIds !== undefined) staff.propertyIds = data.propertyIds;
    if (data.staffRole   !== undefined) staff.staffRole   = data.staffRole;
    if (data.isActive    !== undefined) staff.isActive    = data.isActive;
    if (data.pin         !== undefined) {
      staff.pin           = data.pin;
      // Admin is resetting the PIN → force the staff member to change it on next login.
      // mustChangePin is only set here (admin reset), never on a staff-initiated
      // change-pin flow — that route clears it instead.
      staff.mustChangePin = true;
    }

    await staff.save();

    res.json(staff.toJSON());
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/staffs/:id/archive
// Admin soft-archives a staff account (isArchive = true).
// ─────────────────────────────────────────────────────────────────
router.patch('/staffs/:id/archive', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    if (req.user.role === 'team_leader' && String(staff.clientId) !== String(req.user.serverId)) {
      return res.status(403).json({ error: 'Unauthorized to archive this staff member' });
    }
    staff.isArchive = true;
    await staff.save();
    res.json({ message: 'Staff archived.', staff: staff.toJSON() });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid staff ID' });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// PATCH /api/staffs/:id/unarchive
// Admin restores a staff account from archive (isArchive = false).
// ─────────────────────────────────────────────────────────────────
router.patch('/staffs/:id/unarchive', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });
    if (req.user.role === 'team_leader' && String(staff.clientId) !== String(req.user.serverId)) {
      return res.status(403).json({ error: 'Unauthorized to unarchive this staff member' });
    }
    staff.isArchive = false;
    await staff.save();
    res.json({ message: 'Staff unarchived.', staff: staff.toJSON() });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid staff ID' });
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/staffs/:id
// Admin permanently deletes a staff account.
// ─────────────────────────────────────────────────────────────────
router.delete('/staffs/:id', requireAdminOrTeamLeader, async (req, res, next) => {
  try {
    const staff = await Staff.findById(req.params.id);
    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    if (req.user.role === 'team_leader' && String(staff.clientId) !== String(req.user.serverId)) {
      return res.status(403).json({ error: 'Unauthorized to delete this staff member' });
    }

    await Staff.findByIdAndDelete(req.params.id);
    res.json({ message: 'Staff account deleted successfully.' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid staff ID' });
    }
    next(err);
  }
});

export default router;