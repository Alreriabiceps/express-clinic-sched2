import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const createAdmin = async () => {
  console.log('Creating admin in TEST database...');
  try {
    // Connect to TEST database (where backend is actually connected)
    const mongoURI = 'mongodb://localhost:27017/test';
    console.log('Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB (test database)');

    // Delete ALL existing admin accounts
    const existingAdmins = await User.find({ role: 'admin' });
    if (existingAdmins.length > 0) {
      console.log(`Found ${existingAdmins.length} existing admin account(s). Deleting...`);
      await User.deleteMany({ role: 'admin' });
      console.log('✅ All existing admin accounts deleted.');
    } else {
      console.log('No existing admin accounts found.');
    }

    // Create new admin
    const adminUser = new User({
      email: 'admin@clinic.com',
      password: 'admin123',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
    });

    await adminUser.save();
    console.log('✅ Admin user created successfully in TEST database!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Email: admin@clinic.com');
    
    // Verify password works
    const isValid = await adminUser.comparePassword('admin123');
    console.log('Password verification:', isValid ? '✅ Valid' : '❌ Invalid');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

createAdmin();

