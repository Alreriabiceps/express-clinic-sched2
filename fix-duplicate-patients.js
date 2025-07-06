import mongoose from 'mongoose';
import Patient from './models/Patient.js';
import Appointment from './models/Appointment.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixDuplicatePatientLinks() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic');
    console.log('Connected to MongoDB');
    
    // Get all appointments
    const appointments = await Appointment.find({}).populate('patient');
    
    console.log('\nChecking for appointments with wrong patient links...');
    
    for (const appt of appointments) {
      if (appt.patient) {
        const appointmentPatientName = appt.patientName;
        const linkedPatientName = appt.patient.patientType === 'pediatric' 
          ? appt.patient.pediatricRecord?.nameOfChildren 
          : appt.patient.obGyneRecord?.patientName;
        
        // Check if the appointment patient name doesn't match the linked patient name
        if (appointmentPatientName !== linkedPatientName) {
          console.log(`\n❌ MISMATCH FOUND:`);
          console.log(`   Appointment for: "${appointmentPatientName}"`);
          console.log(`   Linked to patient: "${linkedPatientName}" (ID: ${appt.patient.patientId})`);
          
          // Check if a patient with the correct name already exists
          let correctPatient = await Patient.findOne({
            $or: [
              { 'obGyneRecord.patientName': appointmentPatientName },
              { 'pediatricRecord.nameOfChildren': appointmentPatientName }
            ]
          });
          
          if (!correctPatient) {
            // Create a new patient record for this appointment
            console.log(`   Creating new patient record for: "${appointmentPatientName}"`);
            
            const patientData = {
              patientType: appt.doctorType,
              status: 'Active',
            };
            
            if (appt.doctorType === 'ob-gyne') {
              patientData.obGyneRecord = {
                patientName: appointmentPatientName,
                contactNumber: appt.contactNumber || appt.contactInfo?.primaryPhone || 'N/A'
              };
            } else {
              patientData.pediatricRecord = {
                nameOfChildren: appointmentPatientName,
                contactNumber: appt.contactNumber || appt.contactInfo?.primaryPhone || 'N/A'
              };
            }
            
            correctPatient = new Patient(patientData);
            await correctPatient.save();
            console.log(`   ✅ Created patient record: ${correctPatient.patientId}`);
          } else {
            console.log(`   ✅ Found existing patient record: ${correctPatient.patientId}`);
          }
          
          // Update the appointment to link to the correct patient
          appt.patient = correctPatient._id;
          await appt.save();
          console.log(`   ✅ Updated appointment to link to correct patient`);
        }
      }
    }
    
    console.log('\n✅ All appointments now have correct patient links!');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDuplicatePatientLinks(); 