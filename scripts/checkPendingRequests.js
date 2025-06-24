import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic';

async function checkPendingRequests() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find appointments with pending reschedule requests
    const pendingReschedules = await Appointment.find({
      'rescheduleRequest.status': 'pending'
    }).select('appointmentId patientName doctorName appointmentDate appointmentTime rescheduleRequest');

    // Find appointments with pending cancellation requests
    const pendingCancellations = await Appointment.find({
      'cancellationRequest.status': 'pending'
    }).select('appointmentId patientName doctorName appointmentDate appointmentTime cancellationRequest');

    console.log('\n=== PENDING RESCHEDULE REQUESTS ===');
    if (pendingReschedules.length === 0) {
      console.log('No pending reschedule requests');
    } else {
      pendingReschedules.forEach(apt => {
        console.log(`\nAppointment ID: ${apt.appointmentId}`);
        console.log(`Patient: ${apt.patientName}`);
        console.log(`Doctor: ${apt.doctorName}`);
        console.log(`Current Date/Time: ${apt.appointmentDate.toDateString()} at ${apt.appointmentTime}`);
        console.log(`Reason: ${apt.rescheduleRequest.reason}`);
        console.log(`Requested At: ${apt.rescheduleRequest.requestedAt}`);
        if (apt.rescheduleRequest.preferredDate) {
          console.log(`Preferred Date: ${apt.rescheduleRequest.preferredDate.toDateString()}`);
        }
        if (apt.rescheduleRequest.preferredTime) {
          console.log(`Preferred Time: ${apt.rescheduleRequest.preferredTime}`);
        }
      });
    }

    console.log('\n=== PENDING CANCELLATION REQUESTS ===');
    if (pendingCancellations.length === 0) {
      console.log('No pending cancellation requests');
    } else {
      pendingCancellations.forEach(apt => {
        console.log(`\nAppointment ID: ${apt.appointmentId}`);
        console.log(`Patient: ${apt.patientName}`);
        console.log(`Doctor: ${apt.doctorName}`);
        console.log(`Date/Time: ${apt.appointmentDate.toDateString()} at ${apt.appointmentTime}`);
        console.log(`Reason: ${apt.cancellationRequest.reason}`);
        console.log(`Requested At: ${apt.cancellationRequest.requestedAt}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

checkPendingRequests(); 