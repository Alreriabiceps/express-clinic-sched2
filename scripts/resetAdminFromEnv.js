import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vm-clinic';
    console.log('🔌 Connecting to:', uri);
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    // Delete ALL admin accounts
    console.log('🗑️  Deleting ALL admin accounts...');
    const deleted = await User.deleteMany({ role: 'admin' });
    console.log(`✅ Deleted ${deleted.deletedCount} admin account(s)\n`);

    // Create fresh admin
    console.log('➕ Creating new admin account...');
    const admin = new User({
      username: 'admin',
      email: 'admin@clinic.com',
      password: 'admin123',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
    });
    await admin.save();
    console.log('✅ Admin created:', {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email
    });

    // Verify password
    console.log('\n🔐 Verifying password...');
    const isValid = await admin.comparePassword('admin123');
    console.log('Password "admin123" is:', isValid ? '✅ VALID' : '❌ INVALID');
    
    if (!isValid) {
      console.log('⚠️ Password failed! Resetting manually...');
      const bcrypt = (await import('bcryptjs')).default;
      const salt = await bcrypt.genSalt(12);
      admin.password = await bcrypt.hash('admin123', salt);
      await admin.save();
      
      const retest = await admin.comparePassword('admin123');
      console.log('After manual reset:', retest ? '✅ VALID' : '❌ INVALID');
    }

    console.log('\n✅ DONE! Admin account ready.');
    console.log('Username: admin');
    console.log('Password: admin123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

run();




