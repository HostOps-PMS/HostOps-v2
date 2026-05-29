// ─────────────────────────────────────────────────────────────────
// POST /auth/change-password
// Allows any authenticated user (regular user, staff, clientAccount)
// to change their own password by providing their current password.
//
// Add this route inside your routes/auth.js file.
// Make sure `requireAuth` is imported from your middleware.
//
// For Staff users: req.isStaff === true and req.staff holds the
// Staff document. We load it with +password for bcrypt comparison.
//
// For regular users / team_leaders / admins: req.user holds the
// User document. Load with +password for comparison.
// ─────────────────────────────────────────────────────────────────

import { requireAuth } from '../middleware/auth.js';
import { z } from 'zod';
import User  from '../models/user.js';
import Staff from '../models/staff.js';

const changePwSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     z.string().min(8, 'New password must be at least 8 characters').max(128),
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePwSchema.parse(req.body);

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    // ── Staff path ────────────────────────────────────────────────
    if (req.isStaff) {
      // req.staff is already loaded by requireAuth but WITHOUT password (select: false).
      // Re-fetch with +password so we can run bcrypt.compare.
      const staff = await Staff.findById(req.staff._id).select('+password');
      if (!staff) return res.status(404).json({ error: 'Staff account not found.' });

      const match = await staff.comparePassword(currentPassword);
      if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

      staff.password           = newPassword; // pre-save hook hashes it
      staff.mustChangePassword = false;
      await staff.save();

      return res.json({ message: 'Password updated successfully.' });
    }

    // ── Regular user / admin / team_leader path ───────────────────
    // req.user is loaded without password (select: false in schema).
    // Re-fetch with +password for bcrypt comparison.
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

    user.password           = newPassword; // pre-save hook hashes it
    user.mustChangePassword = false;
    await user.save();

    // Return updated user (without password) so the frontend can persist it
    const updatedUser = user.toJSON ? user.toJSON() : user.toObject();
    delete updatedUser.password;

    return res.json({
      message: 'Password updated successfully.',
      user: updatedUser,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    next(err);
  }
});