import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic';

async function clearPendingRequest(appointmentId) {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const appointment = await Appointment.findOne({ appointmentId });
    
    if (!appointment) {
      console.log(`Appointment ${appointmentId} not found`);
      return;
    }

    console.log(`Found appointment: ${appointment.patientName} - ${appointment.doctorName}`);
    console.log(`Current status: ${appointment.status}`);

    if (appointment.rescheduleRequest && appointment.rescheduleRequest.status === 'pending') {
      console.log('Clearing pending reschedule request...');
      appointment.rescheduleRequest = undefined;
      appointment.status = 'scheduled'; // Reset to scheduled
      await appointment.save();
      console.log('Pending reschedule request cleared successfully');
    } else if (appointment.cancellationRequest && appointment.cancellationRequest.status === 'pending') {
      console.log('Clearing pending cancellation request...');
      appointment.cancellationRequest = undefined;
      appointment.status = 'scheduled'; // Reset to scheduled
      await appointment.save();
      console.log('Pending cancellation request cleared successfully');
    } else {
      console.log('No pending requests found for this appointment');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Get appointment ID from command line argument
const appointmentId = process.argv[2];

if (!appointmentId) {
  console.log('Usage: node clearPendingRequest.js <appointmentId>');
  console.log('Example: node clearPendingRequest.js APT000002');
  process.exit(1);
}

clearPendingRequest(appointmentId); 