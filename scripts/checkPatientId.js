import mongoose from 'mongoose';
import Patient from '../models/Patient.js';

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const checkPatientIds = async () => {
  try {
    // Check for specific ID
    const specificPatient = await Patient.findOne({ patientId: 'OBG000003' });
    console.log('Patient with ID OBG000003:', specificPatient ? 'EXISTS' : 'NOT FOUND');
    
    if (specificPatient) {
      console.log('Patient details:', {
        _id: specificPatient._id,
        patientId: specificPatient.patientId,
        patientNumber: specificPatient.patientNumber,
        patientType: specificPatient.patientType,
        name: specificPatient.obGyneRecord?.patientName || specificPatient.pediatricRecord?.nameOfChildren,
        createdAt: specificPatient.createdAt
      });
    }
    
    // Get all OB-GYNE patient IDs
    const obgynePatients = await Patient.find(
      { patientType: 'ob-gyne' },
      { patientId: 1, patientNumber: 1, 'obGyneRecord.patientName': 1, createdAt: 1 }
    ).sort({ patientId: 1 });
    
    console.log('\nAll OB-GYNE patient IDs:');
    obgynePatients.forEach(patient => {
      console.log(`  ${patient.patientId} (${patient.patientNumber}) - ${patient.obGyneRecord?.patientName || 'No name'} - Created: ${patient.createdAt}`);
    });
    
    // Get all Pediatric patient IDs
    const pediatricPatients = await Patient.find(
      { patientType: 'pediatric' },
      { patientId: 1, patientNumber: 1, 'pediatricRecord.nameOfChildren': 1, createdAt: 1 }
    ).sort({ patientId: 1 });
    
    console.log('\nAll Pediatric patient IDs:');
    pediatricPatients.forEach(patient => {
      console.log(`  ${patient.patientId} (${patient.patientNumber}) - ${patient.pediatricRecord?.nameOfChildren || 'No name'} - Created: ${patient.createdAt}`);
    });
    
    console.log(`\nTotal OB-GYNE patients: ${obgynePatients.length}`);
    console.log(`Total Pediatric patients: ${pediatricPatients.length}`);
    
  } catch (error) {
    console.error('Error checking patient IDs:', error);
  }
};

const main = async () => {
  await connectDB();
  await checkPatientIds();
  await mongoose.disconnect();
  console.log('Check completed');
};

main().catch(console.error); 