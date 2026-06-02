// scripts/seedAdmin.js
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/user.js';

const ADMIN = {
  email:        'h.sarmiento@telexph.com',
  password:     'password',
  businessName: 'Innovation Admin',
  firstName:    'Innovation',
  lastName:     'Admin',
  tag:          'Main Admin',
  role:         'admin',
  isVerified:   true,
  properties:   [],
};

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✓ MongoDB connected:', mongoose.connection.name);

    const existing = await User.findOne({ email: ADMIN.email });

    if (existing) {
      existing.role         = 'admin';
      existing.tag          = ADMIN.tag;
      existing.isVerified   = true;
      // Preserve existing businessName if already set; fall back to env/default
      if (!existing.businessName) {
        existing.businessName = ADMIN.businessName;
      }
      await existing.save();
      console.log('✓ Existing user updated to admin:', ADMIN.email);
    } else {
      await User.create(ADMIN);
      console.log('✓ Admin created successfully:', ADMIN.email);
    }

    console.log('\nAdmin account details:');
    console.log('  Email        :', ADMIN.email);
    console.log('  Password     :', ADMIN.password);
    console.log('  Business Name:', ADMIN.businessName);
    console.log('  Tag          :', ADMIN.tag);
    console.log('  Role         :', ADMIN.role);
    console.log('  Properties   :', ADMIN.properties.length, '(none — add via admin panel)');

  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Done. MongoDB disconnected.');
  }
}

seed();