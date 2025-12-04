// Script to backfill endTime for existing appointments
// Calculates endTime as 30 minutes after appointmentTime for appointments that don't have it

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Appointment from '../models/Appointment.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Helper function to add 30 minutes to a time string
function add30Minutes(timeString) {
  // Parse time string like "01:00 PM" or "09:30 AM"
  const [time, period] = timeString.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let totalMinutes = hours * 60 + minutes;
  if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
  if (period === 'AM' && hours === 12) totalMinutes -= 12 * 60;
  
  // Add 30 minutes
  totalMinutes += 30;
  
  // Convert back to 12-hour format
  let newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  
  let newPeriod = 'AM';
  if (newHours >= 12) {
    newPeriod = 'PM';
    if (newHours > 12) newHours -= 12;
  }
  if (newHours === 0) newHours = 12;
  
  return `${newHours}:${String(newMinutes).padStart(2, '0')} ${newPeriod}`;
}

const run = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI missing in .env');
    process.exit(1);
  }
  
  console.log('🔌 Connecting to:', uri);
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  // Find all appointments without endTime
  const appointments = await Appointment.find({
    $or: [
      { endTime: { $exists: false } },
      { endTime: null },
      { endTime: '' }
    ],
    appointmentTime: { $exists: true, $ne: null }
  });

  console.log(`📋 Found ${appointments.length} appointments without endTime\n`);

  if (appointments.length === 0) {
    console.log('✅ All appointments already have endTime set!');
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const appointment of appointments) {
    try {
      const calculatedEndTime = add30Minutes(appointment.appointmentTime);
      appointment.endTime = calculatedEndTime;
      await appointment.save();
      updated++;
      console.log(`✅ Updated ${appointment.appointmentId}: ${appointment.appointmentTime} → ${calculatedEndTime}`);
    } catch (error) {
      errors++;
      console.error(`❌ Error updating ${appointment.appointmentId}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`\n✅ Done!`);

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB');
};

run().catch(err => {
  console.error('❌ Script error:', err);
  mongoose.disconnect();
  process.exit(1);
});




