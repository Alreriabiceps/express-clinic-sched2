import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config({ path: './.env' });

const createAdmin = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      throw new Error('MONGODB_URI is not defined in your .env file');
    }

    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
    }

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log('Admin user already exists.');
      mongoose.connection.close();
      return;
    }

    const adminUser = new User({
      email: adminEmail,
      password: adminPassword,
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
    });

    await adminUser.save();
    console.log('Admin user created successfully!');
    
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

createAdmin(); 