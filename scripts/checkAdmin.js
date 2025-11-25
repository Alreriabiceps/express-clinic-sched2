import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const checkAdmin = async () => {
  console.log('Checking admin accounts...');
  try {
    const mongoURI = 'mongodb://localhost:27017/vm-clinic';
    console.log('Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Find all admin accounts
    const admins = await User.find({ role: 'admin' });
    console.log(`\nFound ${admins.length} admin account(s):`);
    
    admins.forEach((admin, index) => {
      console.log(`\nAdmin ${index + 1}:`);
      console.log(`  ID: ${admin._id}`);
      console.log(`  Username: ${admin.username}`);
      console.log(`  Email: ${admin.email}`);
      console.log(`  First Name: ${admin.firstName}`);
      console.log(`  Last Name: ${admin.lastName}`);
      console.log(`  Role: ${admin.role}`);
      console.log(`  Is Active: ${admin.isActive}`);
      console.log(`  Created: ${admin.createdAt}`);
    });

    // Test password comparison
    if (admins.length > 0) {
      const admin = admins[0];
      console.log(`\nTesting password for admin: ${admin.username}`);
      const testPassword = 'admin123';
      const isValid = await admin.comparePassword(testPassword);
      console.log(`Password 'admin123' is valid: ${isValid}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking admin:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
};

checkAdmin();

