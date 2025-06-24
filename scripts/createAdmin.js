import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config({ path: './.env' });

const createAdmin = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic-db';
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    // Hardcoded admin credentials
    const adminEmail = 'admin@clinic.com';
    const adminPassword = 'admin123';
    const adminUsername = 'admin';

    const existingAdmin = await User.findOne({ 
      $or: [{ email: adminEmail }, { username: adminUsername }]
    });

    if (existingAdmin) {
      console.log('Admin user already exists.');
      console.log('Username:', existingAdmin.username);
      console.log('Email:', existingAdmin.email);
      mongoose.connection.close();
      return;
    }

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
    console.log('✅ Admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('Email: admin@clinic.com');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
};

createAdmin(); 