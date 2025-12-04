import mongoose from 'mongoose';
import User from '../models/User.js';

const verifyAdmin = async () => {
  try {
    const mongoURI = 'mongodb://localhost:27017/test';
    console.log('Connecting to TEST database...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB (test database)');

    // Find admin
    const admin = await User.findOne({ role: 'admin' });
    
    if (!admin) {
      console.log('❌ No admin found in test database!');
      return;
    }

    console.log('✅ Admin found:', {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive
    });

    // Test password
    console.log('\nTesting password "admin123"...');
    const isValid = await admin.comparePassword('admin123');
    console.log('Password validation:', isValid ? '✅ VALID' : '❌ INVALID');
    
    if (!isValid) {
      console.log('\n⚠️ Password failed! Resetting password...');
      admin.password = 'admin123';
      await admin.save();
      
      const retest = await admin.comparePassword('admin123');
      console.log('After reset, password validation:', retest ? '✅ VALID' : '❌ INVALID');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    mongoose.connection.close();
  }
};

verifyAdmin();




