import mongoose from 'mongoose';
import Patient from './models/Patient.js';
import Appointment from './models/Appointment.js';
import dotenv from 'dotenv';

dotenv.config();

async function checkAllPatients() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic');
    console.log('Connected to MongoDB');
    
    // Get all patients
    const allPatients = await Patient.find({});
    console.log(`\nTotal patients in database: ${allPatients.length}`);
    
    // Get all appointments
    const allAppointments = await Appointment.find({}).populate('patient');
    console.log(`Total appointments in database: ${allAppointments.length}`);
    
    // Check each appointment to see if patient exists
    console.log('\n=== APPOINTMENT TO PATIENT MAPPING ===');
    for (const appt of allAppointments) {
      const patientName = appt.patientName;
      const hasPatientRecord = appt.patient ? 'YES' : 'NO';
      const patientId = appt.patient ? appt.patient.patientId : 'MISSING';
      const patientStatus = appt.patient ? appt.patient.status : 'N/A';
      
      console.log(`Appointment: ${patientName} | Has Patient Record: ${hasPatientRecord} | Patient ID: ${patientId} | Status: ${patientStatus}`);
    }
    
    // List all patients and their status
    console.log('\n=== ALL PATIENTS IN DATABASE ===');
    for (const patient of allPatients) {
      const name = patient.patientType === 'pediatric' 
        ? patient.pediatricRecord?.nameOfChildren 
        : patient.obGyneRecord?.patientName;
      console.log(`Patient: ${name} | ID: ${patient.patientId} | Type: ${patient.patientType} | Status: ${patient.status} | Active: ${patient.isActive !== false}`);
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAllPatients(); 