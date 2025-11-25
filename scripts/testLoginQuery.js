import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const testLoginQuery = async () => {
  console.log('Testing login query...');
  try {
    const mongoURI = 'mongodb://localhost:27017/vm-clinic';
    console.log('Connecting to:', mongoURI);
    
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const testUsername = 'admin';
    const testPassword = 'admin123';

    console.log(`\nTesting with username: "${testUsername}"`);
    console.log(`Testing with password: "${testPassword}"`);

    // Test the exact query from the login route
    const user = await User.findOne({
      $or: [
        { username: testUsername.toLowerCase() },
        { email: testUsername.toLowerCase() }
      ],
      isActive: true
    });

    if (!user) {
      console.log('❌ User not found with the query!');
      
      // Try to find by exact username
      const exactUser = await User.findOne({ username: testUsername });
      console.log(`\nExact username match: ${exactUser ? 'Found' : 'Not found'}`);
      if (exactUser) {
        console.log(`  Username in DB: "${exactUser.username}"`);
        console.log(`  Email in DB: "${exactUser.email}"`);
        console.log(`  Is Active: ${exactUser.isActive}`);
      }
      
      // Try to find by email
      const emailUser = await User.findOne({ email: testUsername.toLowerCase() });
      console.log(`\nEmail match: ${emailUser ? 'Found' : 'Not found'}`);
      
      // List all users
      const allUsers = await User.find({});
      console.log(`\nAll users in database (${allUsers.length}):`);
      allUsers.forEach(u => {
        console.log(`  - Username: "${u.username}" (type: ${typeof u.username}), Email: "${u.email}", Active: ${u.isActive}`);
      });
    } else {
      console.log('✅ User found!');
      console.log(`  Username: "${user.username}"`);
      console.log(`  Email: "${user.email}"`);
      console.log(`  Is Active: ${user.isActive}`);
      
      // Test password
      const isValidPassword = await user.comparePassword(testPassword);
      console.log(`\nPassword validation: ${isValidPassword ? '✅ Valid' : '❌ Invalid'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    mongoose.connection.close();
    console.log('\nMongoDB connection closed.');
  }
};

testLoginQuery();

