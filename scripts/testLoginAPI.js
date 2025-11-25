import mongoose from 'mongoose';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

const testLogin = async () => {
  try {
    const mongoURI = 'mongodb://localhost:27017/test';
    console.log('Connecting to TEST database...');
    await mongoose.connect(mongoURI);
    console.log('Connected\n');

    // Simulate the exact login query
    const username = 'admin';
    const password = 'admin123';
    
    console.log('Testing login with:');
    console.log('  Username:', username);
    console.log('  Password:', password);
    console.log('');

    // Find user (exact query from login route)
    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() }
      ],
      isActive: true
    });

    if (!user) {
      console.log('❌ User not found!');
      return;
    }

    console.log('✅ User found:');
    console.log('  ID:', user._id.toString());
    console.log('  Username:', user.username);
    console.log('  Email:', user.email);
    console.log('  Role:', user.role);
    console.log('  Is Active:', user.isActive);
    console.log('  Password hash (first 30):', user.password.substring(0, 30));
    console.log('');

    // Test password with comparePassword method
    console.log('Testing with user.comparePassword()...');
    const methodTest = await user.comparePassword(password);
    console.log('  Result:', methodTest ? '✅ VALID' : '❌ INVALID');
    console.log('');

    // Test password with direct bcrypt
    console.log('Testing with direct bcrypt.compare()...');
    const directTest = await bcrypt.compare(password, user.password);
    console.log('  Result:', directTest ? '✅ VALID' : '❌ INVALID');
    console.log('');

    if (!methodTest && !directTest) {
      console.log('⚠️ Both methods failed!');
      console.log('Resetting password...');
      const salt = await bcrypt.genSalt(12);
      user.password = await bcrypt.hash('admin123', salt);
      await user.save();
      console.log('✅ Password reset');
      
      const retest = await user.comparePassword('admin123');
      console.log('After reset:', retest ? '✅ VALID' : '❌ INVALID');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
  }
};

testLogin();

