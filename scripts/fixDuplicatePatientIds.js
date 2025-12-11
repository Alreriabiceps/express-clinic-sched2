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

const fixDuplicatePatientIds = async () => {
  try {
    console.log('Checking for duplicate patient IDs...');
    
    // Find all patients
    const allPatients = await Patient.find({}).sort({ createdAt: 1 });
    console.log(`Found ${allPatients.length} total patients`);
    
    // Group by patientId to find duplicates
    const patientIdGroups = {};
    allPatients.forEach(patient => {
      if (!patientIdGroups[patient.patientId]) {
        patientIdGroups[patient.patientId] = [];
      }
      patientIdGroups[patient.patientId].push(patient);
    });
    
    // Find duplicates
    const duplicates = Object.entries(patientIdGroups).filter(([id, patients]) => patients.length > 1);
    
    if (duplicates.length === 0) {
      console.log('No duplicate patient IDs found!');
      return;
    }
    
    console.log(`Found ${duplicates.length} duplicate patient ID(s):`);
    duplicates.forEach(([id, patients]) => {
      console.log(`  ${id}: ${patients.length} patients`);
    });
    
    // Fix duplicates by regenerating IDs for all but the first (oldest) patient
    for (const [duplicateId, patients] of duplicates) {
      console.log(`\nFixing duplicate ID: ${duplicateId}`);
      
      // Keep the first (oldest) patient with this ID
      const [keepPatient, ...duplicatePatients] = patients;
      console.log(`  Keeping patient: ${keepPatient._id} (created: ${keepPatient.createdAt})`);
      
      // Regenerate IDs for the duplicate patients
      for (const patient of duplicatePatients) {
        const oldId = patient.patientId;
        
        // Generate new ID
        const prefix = patient.patientType === 'pediatric' ? 'PED' : 'OBG';
        
        // Find the highest existing number for this patient type
        const lastPatient = await Patient.findOne(
          { patientType: patient.patientType },
          { patientId: 1 }
        ).sort({ patientId: -1 });
        
        let nextNumber = 1;
        if (lastPatient && lastPatient.patientId) {
          const lastNumber = parseInt(lastPatient.patientId.substring(3));
          nextNumber = lastNumber + 1;
        }
        
        // Find next available ID
        let newId;
        let attempts = 0;
        while (attempts < 100) {
          const candidateId = `${prefix}${String(nextNumber).padStart(6, '0')}`;
          const existing = await Patient.findOne({ patientId: candidateId });
          if (!existing) {
            newId = candidateId;
            break;
          }
          nextNumber++;
          attempts++;
        }
        
        if (!newId) {
          console.error(`  Failed to generate new ID for patient ${patient._id}`);
          continue;
        }
        
        // Update the patient with new ID
        await Patient.updateOne(
          { _id: patient._id },
          { 
            patientId: newId,
            patientNumber: newId
          }
        );
        
        console.log(`  Updated patient ${patient._id}: ${oldId} -> ${newId}`);
      }
    }
    
    console.log('\nDuplicate patient ID fix completed!');
    
  } catch (error) {
    console.error('Error fixing duplicate patient IDs:', error);
  }
};

const main = async () => {
  await connectDB();
  await fixDuplicatePatientIds();
  await mongoose.disconnect();
  console.log('Script completed');
};

main().catch(console.error); 