import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Patient from '../models/Patient.js';
import PatientUser from '../models/PatientUser.js';

dotenv.config();

async function createLockedPatient() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/vm-clinic';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if patient user already exists
    const existingUser = await PatientUser.findOne({ email: 'locked.patient@test.com' });
    if (existingUser) {
      console.log('⚠️  Patient user already exists. Deleting old account...');
      if (existingUser.patientRecord) {
        await Patient.findByIdAndDelete(existingUser.patientRecord);
      }
      await PatientUser.findByIdAndDelete(existingUser._id);
    }

    // Create a test patient with 3 no-shows (locked)
    const testPatient = new Patient({
      patientType: 'ob-gyne',
      obGyneRecord: {
        patientName: 'John Doe (Locked)',
        address: '123 Test Street, Test City',
        contactNumber: '09123456789',
        birthDate: new Date('1990-01-15'),
        age: 34,
        civilStatus: 'Single',
        occupation: 'Software Developer',
        religion: 'Christian',
        pastMedicalHistory: {
          hypertension: false,
          diabetes: false,
          bronchialAsthma: false,
          heartDisease: false,
          thyroidDisease: false,
          allergies: 'None'
        },
        familyHistory: {
          smoker: false,
          alcohol: false,
          drugs: false
        },
        gynecologicHistory: {
          intervalIsRegular: true
        },
        consultations: []
      },
      status: 'Active',
      // Set no-show count and lock status
      noShowCount: 3,
      appointmentLocked: true,
      lastNoShowAt: new Date()
    });

    // Save the patient (this will auto-generate patientId)
    await testPatient.save();
    
    // Create PatientUser account for login
    const patientUser = new PatientUser({
      email: 'locked.patient@test.com',
      password: 'test123456', // Will be hashed automatically
      firstName: 'John',
      lastName: 'Doe',
      phoneNumber: '09123456789',
      dateOfBirth: new Date('1990-01-15'),
      gender: 'Male',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        province: 'Test Province',
        zipCode: '1234'
      },
      consent: true,
      consentDate: new Date(),
      patientRecord: testPatient._id, // Link to patient record
      isActive: true,
      isVerified: true
    });

    await patientUser.save();
    
    console.log('✅ Test patient and account created successfully!');
    console.log('\n📋 Patient Details:');
    console.log(`   Patient ID: ${testPatient.patientId}`);
    console.log(`   Name: ${testPatient.obGyneRecord.patientName}`);
    console.log(`   Contact: ${testPatient.obGyneRecord.contactNumber}`);
    console.log(`   No-Show Count: ${testPatient.noShowCount}`);
    console.log(`   Appointment Locked: ${testPatient.appointmentLocked}`);
    console.log('\n🔐 Login Credentials:');
    console.log(`   Email: locked.patient@test.com`);
    console.log(`   Password: test123456`);
    console.log('\n🎯 This patient is now locked and cannot book appointments.');
    console.log('   You can unlock them using the "Unlock Appointment" button in the Patient Detail view.');
    console.log('   Use the credentials above to login to the patient portal and see the locked booking feature.');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating locked patient:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

createLockedPatient();


