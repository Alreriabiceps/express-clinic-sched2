import mongoose from 'mongoose';
import User from '../models/User.js';

const cleanupAndCreate = async () => {
  try {
    const mongoURI = 'mongodb://localhost:27017/test';
    console.log('Connecting to TEST database...');
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB (test database)');

    // Find ALL admin accounts
    const allAdmins = await User.find({ role: 'admin' });
    console.log(`\nFound ${allAdmins.length} admin account(s):`);
    allAdmins.forEach((admin, i) => {
      console.log(`  ${i + 1}. ID: ${admin._id}, username: ${admin.username}, email: ${admin.email}`);
    });

    // Delete ALL admin accounts
    if (allAdmins.length > 0) {
      console.log('\n🗑️  Deleting ALL admin accounts...');
      await User.deleteMany({ role: 'admin' });
      console.log('✅ All admin accounts deleted.');
    }

    // Create fresh admin
    console.log('\n➕ Creating new admin account...');
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
    console.log('✅ Admin created:', {
      id: adminUser._id.toString(),
      username: adminUser.username,
      email: adminUser.email
    });

    // Verify it works
    console.log('\n🔐 Verifying password...');
    const isValid = await adminUser.comparePassword('admin123');
    console.log('Password "admin123" is:', isValid ? '✅ VALID' : '❌ INVALID');
    
    if (!isValid) {
      console.log('⚠️ Password failed! Trying manual reset...');
      const bcrypt = (await import('bcryptjs')).default;
      const salt = await bcrypt.genSalt(12);
      adminUser.password = await bcrypt.hash('admin123', salt);
      await adminUser.save();
      
      const retest = await adminUser.comparePassword('admin123');
      console.log('After manual reset:', retest ? '✅ VALID' : '❌ INVALID');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
    console.log('\n✅ Done!');
  }
};

cleanupAndCreate();




