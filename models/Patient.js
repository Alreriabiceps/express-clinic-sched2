import mongoose from 'mongoose';

// Schema for Pediatric patient records
const pediatricRecordSchema = new mongoose.Schema({
  // Patient Information
  nameOfMother: { type: String, trim: true },
  nameOfFather: { type: String, trim: true },
  nameOfChildren: { type: String, trim: true },
  address: { type: String, trim: true },
  contactNumber: { type: String, trim: true },
  birthDate: { type: Date },
  birthWeight: { type: String, trim: true },
  birthLength: { type: String, trim: true },
  
  // Immunization History
  immunizations: [{
    vaccine: {
      type: String,
      enum: ['BCG', 'HEPATITIS_B', 'DPT_1', 'DPT_2', 'DPT_3', 'POLIO_1', 'POLIO_2', 'POLIO_3', 'MMR', 'VARICELLA', 'PNEUMOCOCCAL', 'ROTAVIRUS', 'INFLUENZA', 'OTHER']
    },
    date: { type: Date },
    remarks: { type: String, trim: true }
  }],
  
  // Consultation Records
  consultations: [{
    date: { type: Date, default: Date.now },
    historyAndPE: { type: String, trim: true },
    natureTxn: { type: String, trim: true },
    impression: { type: String, trim: true }
  }]
});

// Schema for OB-GYNE patient records
const obGyneRecordSchema = new mongoose.Schema({
  // Patient Information
  patientName: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  contactNumber: { type: String, trim: true },
  birthDate: { type: Date },
  civilStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'] },
  occupation: { type: String, trim: true },
  
  // Past Medical History
  pastMedicalHistory: {
    hypertension: { type: Boolean, default: false },
    diabetes: { type: Boolean, default: false },
    heartDisease: { type: Boolean, default: false },
    asthma: { type: Boolean, default: false },
    allergies: { type: String, trim: true },
    medications: { type: String, trim: true },
    surgeries: { type: String, trim: true },
    other: { type: String, trim: true }
  },
  
  // Obstetric and Gynecologic History
  obstetricHistory: [{
    year: { type: Number },
    place: { type: String, trim: true },
    typeOfDelivery: { type: String, enum: ['NSD', 'CS', 'Assisted'] },
    birthWeight: { type: String, trim: true },
    complications: { type: String, trim: true }
  }],
  
  gynecologicHistory: {
    lmp: { type: Date }, // Last Menstrual Period
    menstrualCycle: { type: String, trim: true },
    contraceptiveUse: { type: String, trim: true },
    gravida: { type: Number, default: 0 },
    para: { type: Number, default: 0 },
    abortions: { type: Number, default: 0 }
  },
  
  // Consultation Records
  consultations: [{
    date: { type: Date, default: Date.now },
    bp: { type: String, trim: true }, // Blood Pressure
    hr: { type: String, trim: true }, // Heart Rate
    historyPhysicalExam: { type: String, trim: true },
    assessmentPlan: { type: String, trim: true },
    medications: [{
      name: { type: String, trim: true },
      dosage: { type: String, trim: true },
      frequency: { type: String, trim: true },
      duration: { type: String, trim: true }
    }]
  }]
});

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    unique: true,
    required: true
  },
  patientType: {
    type: String,
    enum: ['pediatric', 'ob-gyne'],
    required: true
  },
  
  // Common fields
  contactInfo: {
    email: { type: String, lowercase: true, trim: true },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true }
    }
  },
  
  // Type-specific records
  pediatricRecord: {
    type: pediatricRecordSchema,
    required: function() { return this.patientType === 'pediatric'; }
  },
  
  obGyneRecord: {
    type: obGyneRecordSchema,
    required: function() { return this.patientType === 'ob-gyne'; }
  },
  
  // General fields
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Patient status for appointment workflow
  status: {
    type: String,
    enum: ['New', 'Active', 'Inactive'],
    default: 'New'
  },
  
  notes: [{
    text: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Auto-generate patient ID
patientSchema.pre('save', async function(next) {
  if (!this.patientId) {
    try {
      const prefix = this.patientType === 'pediatric' ? 'PED' : 'OBG';
      const count = await this.constructor.countDocuments({ patientType: this.patientType });
      this.patientId = `${prefix}${String(count + 1).padStart(6, '0')}`;
      console.log(`Generated patientId: ${this.patientId} for patientType: ${this.patientType}`);
    } catch (error) {
      console.error('Error generating patientId:', error);
      return next(error);
    }
  }
  next();
});

// Index for search
patientSchema.index({ 
  patientId: 1,
  'pediatricRecord.nameOfChildren': 'text',
  'pediatricRecord.nameOfMother': 'text',
  'obGyneRecord.patientName': 'text'
});

export default mongoose.model('Patient', patientSchema); 