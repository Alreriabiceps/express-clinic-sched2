import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const resetAdmin = async () => {
  console.log('Resetting admin account...');
  try {
    const mongoURI = 'mongodb://localhost:27017/vm-clinic';
    console.log('Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // List all admin accounts first
    const allAdmins = await User.find({ role: 'admin' });
    console.log(`\nFound ${allAdmins.length} admin account(s) before deletion:`);
    allAdmins.forEach((admin, index) => {
      console.log(`  ${index + 1}. ID: ${admin._id}, Username: ${admin.username}, Email: ${admin.email}`);
    });

    // Delete ALL admin accounts
    const deleteResult = await User.deleteMany({ role: 'admin' });
    console.log(`\n✅ Deleted ${deleteResult.deletedCount} admin account(s).`);

    // Create new admin account
    const adminEmail = 'admin@clinic.com';
    const adminPassword = 'admin123';
    const adminUsername = 'admin';

    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      username: adminUsername,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
    });

    await adminUser.save();
    console.log('\n✅ New admin user created successfully!');
    console.log(`  ID: ${adminUser._id}`);
    console.log(`  Username: ${adminUser.username}`);
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Password: ${adminPassword}`);
    
    // Verify the password works
    console.log('\nVerifying password...');
    const isValid = await adminUser.comparePassword(adminPassword);
    console.log(`Password validation test: ${isValid ? '✅ PASS' : '❌ FAIL'}`);
    
  } catch (error) {
    console.error('❌ Error resetting admin:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
};

resetAdmin();

