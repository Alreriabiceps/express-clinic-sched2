import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const listAllAdmins = async () => {
  console.log('Listing ALL admin accounts...');
  try {
    const mongoURI = 'mongodb://localhost:27017/vm-clinic';
    console.log('Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find ALL admin accounts
    const admins = await User.find({ role: 'admin' });
    console.log(`\nFound ${admins.length} admin account(s):\n`);
    
    for (let i = 0; i < admins.length; i++) {
      const admin = admins[i];
      console.log(`Admin ${i + 1}:`);
      console.log(`  ID: ${admin._id}`);
      console.log(`  Username: "${admin.username}"`);
      console.log(`  Email: "${admin.email}"`);
      console.log(`  Is Active: ${admin.isActive}`);
      console.log(`  Created: ${admin.createdAt}`);
      
      // Test password for each
      const isValid = await admin.comparePassword('admin123');
      console.log(`  Password 'admin123' valid: ${isValid}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

listAllAdmins();




