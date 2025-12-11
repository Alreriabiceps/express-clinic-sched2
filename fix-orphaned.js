import mongoose from 'mongoose';
import Appointment from './models/Appointment.js';
import Patient from './models/Patient.js';
import dotenv from 'dotenv';

dotenv.config();

async function fixOrphanedAppointments() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/clinic');
    console.log('Connected to MongoDB');
    
    // Find all appointments
    const appointments = await Appointment.find({}).populate('patient');
    console.log(`Total appointments: ${appointments.length}`);
    
    // Find orphaned appointments (appointments without valid patient records)
    const orphaned = appointments.filter(appt => !appt.patient);
    console.log(`Orphaned appointments: ${orphaned.length}`);
    
    if (orphaned.length > 0) {
      console.log('\nCreating patient records for orphaned appointments...');
      
      for (const appt of orphaned) {
        console.log(`Processing appointment for: ${appt.patientName}`);
        
        // Create new patient record
        const patientData = {
          patientType: appt.doctorType,
          status: 'Active',
        };
        
        if (appt.doctorType === 'ob-gyne') {
          patientData.obGyneRecord = {
            patientName: appt.patientName,
            contactNumber: appt.contactNumber || appt.contactInfo?.primaryPhone || 'N/A'
          };
        } else {
          patientData.pediatricRecord = {
            nameOfChildren: appt.patientName,
            contactNumber: appt.contactNumber || appt.contactInfo?.primaryPhone || 'N/A'
          };
        }
        
        const newPatient = new Patient(patientData);
        await newPatient.save();
        
        // Link appointment to new patient
        appt.patient = newPatient._id;
        await appt.save();
        
        console.log(`✓ Created patient record for: ${appt.patientName} (ID: ${newPatient.patientId})`);
      }
      
      console.log(`\n✅ Successfully created ${orphaned.length} patient records!`);
    } else {
      console.log('✅ No orphaned appointments found. All appointments have valid patient records.');
    }
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixOrphanedAppointments(); 