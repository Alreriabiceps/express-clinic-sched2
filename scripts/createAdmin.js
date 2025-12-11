import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  try {
    // Connect to MongoDB (use same default as app.js)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vm-clinic');
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin account already exists');
      process.exit(0);
    }

    // Create admin account
    const admin = new User({
      username: 'admin',
      email: 'admin@clinic.com',
      password: 'admin123', // This will be hashed by the pre-save hook
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true
    });

    await admin.save();
    console.log('Admin account created successfully');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Please change these credentials after first login');

  } catch (error) {
    console.error('Error creating admin account:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createAdmin(); 