import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fixAdminPassword = async () => {
  console.log('Fixing admin password...');
  try {
    const mongoURI = 'mongodb://localhost:27017/vm-clinic';
    console.log('Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find admin
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      console.log('No admin found, creating one...');
      const newAdmin = new User({
        username: 'admin',
        email: 'admin@clinic.com',
        password: 'admin123',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true
      });
      await newAdmin.save();
      console.log('✅ Admin created');
      return;
    }

    console.log('Found admin:', {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email
    });

    // Test current password
    const currentTest = await admin.comparePassword('admin123');
    console.log('Current password test (admin123):', currentTest);

    // If it doesn't work, reset it
    if (!currentTest) {
      console.log('Password validation failed, resetting password...');
      admin.password = 'admin123'; // This will trigger the pre-save hook to hash it
      await admin.save();
      console.log('✅ Password reset');
      
      // Verify it works
      const verifyTest = await admin.comparePassword('admin123');
      console.log('Verification test:', verifyTest);
      
      if (!verifyTest) {
        console.log('❌ Still failing, trying manual hash...');
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash('admin123', salt);
        admin.password = hash;
        await admin.save();
        
        const finalTest = await admin.comparePassword('admin123');
        console.log('Final test:', finalTest);
      }
    } else {
      console.log('✅ Password is already correct');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

fixAdminPassword();




