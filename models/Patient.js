import mongoose from 'mongoose';

// Schema for Pediatric patient records
const pediatricRecordSchema = new mongoose.Schema({
  // Patient Information
  nameOfChildren: { type: String, trim: true, required: true },
  nameOfMother: { type: String, trim: true },
  nameOfFather: { type: String, trim: true },
  address: { type: String, trim: true },
  contactNumber: { type: String, trim: true },
  birthDate: { type: Date },
  age: { type: String, trim: true },
  sex: { type: String, enum: ['Male', 'Female'], trim: true },
  birthWeight: { type: String, trim: true },
  birthLength: { type: String, trim: true },
  
  // Immunization History
  immunizations: {
    dpt: { 
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
      d3: {date: Date, remarks: String},
      b1: {date: Date, remarks: String},
      b2: {date: Date, remarks: String},
    },
    opvIpv: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
      d3: {date: Date, remarks: String},
      b1: {date: Date, remarks: String},
      b2: {date: Date, remarks: String},
    },
    hInfluenzaHib: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
      d3: {date: Date, remarks: String}, 
      d4: {date: Date, remarks: String},
    },
    measlesMmr: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
    },
    pneumococcalPcv: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
      d3: {date: Date, remarks: String}, 
      d4: {date: Date, remarks: String},
    },
    pneumococcalPpv: { date: Date, remarks: String },
    rotavirus: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
      d3: {date: Date, remarks: String},
    },
    varicella: { date: Date, remarks: String },
    hepatitisA: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
    },
    tdaPTdp: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
    },
    meningococcal: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String},
    },
    influenza: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
      d3: {date: Date, remarks: String}, 
      d4: {date: Date, remarks: String},
      d5: {date: Date, remarks: String},
    },
    japaneseEncephalitis: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
    },
    hpv: {
      d1: {date: Date, remarks: String}, 
      d2: {date: Date, remarks: String}, 
      d3: {date: Date, remarks: String}, 
    },
    mantouxTest: { date: Date, remarks: String },
  },
  
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
  // Patient Information from form
  patientName: { type: String, required: true, trim: true },
  address: { type: String, trim: true },
  contactNumber: { type: String, trim: true },
  birthDate: { type: Date },
  age: { type: Number },
  civilStatus: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'], trim: true },
  occupation: { type: String, trim: true },
  religion: { type: String, trim: true },
  referredBy: { type: String, trim: true },
  
  // Past Medical History from form
  pastMedicalHistory: {
    hypertension: { type: Boolean, default: false },
    diabetes: { type: Boolean, default: false },
    bronchialAsthma: { type: Boolean, default: false },
    lastAttack: { type: Date }, // Changed to Date for date picker
    heartDisease: { type: Boolean, default: false },
    thyroidDisease: { type: Boolean, default: false },
    previousSurgery: { type: Date }, // Changed to Date for date picker
    allergies: { type: String, trim: true },
    others: { type: String, trim: true }, // For additional medical history comments
  },

  // Family History from form
  familyHistory: {
    smoker: { type: Boolean, default: false },
    alcohol: { type: Boolean, default: false },
    drugs: { type: Boolean, default: false },
  },

  // Baseline Diagnostics from form
  baselineDiagnostics: {
    cbc: { hgb: String, hct: String, plt: String, wbc: String },
    urinalysis: String,
    bloodType: String,
    fbs: String,
    hbsag: String,
    vdrlRpr: String,
    hiv: String,
    ogtt75g: { fbs: String, firstHour: String, secondHour: String },
    other: String
  },
  
  // Obstetric and Gynecologic History from form
  obstetricHistory: [{
    year: { type: Number },
    place: { type: String, trim: true },
    typeOfDelivery: { type: String, trim: true },
    bw: { type: String, trim: true }, // Birth Weight
    complications: { type: String, trim: true }
  }],
  
  gynecologicHistory: {
    obScore: String,
    gravidity: Number,
    parity: Number,
    lmp: { type: Date }, // Last Menstrual Period
    pmp: { type: Date }, // Past Menstrual Period
    aog: String, // Age of Gestation
    earlyUltrasound: Date,
    aogByEutz: String,
    eddByLmp: Date,
    eddByEutz: Date,
    menarche: Number, // Age
    intervalIsRegular: Boolean,
    intervalDays: Number,
    durationDays: Number,
    amountPads: String,
    dysmenorrhea: Boolean,
    coitarche: Number, // Age
    sexualPartners: Number,
    contraceptiveUse: String,
    lastPapSmear: {
      date: Date,
      result: String
    }
  },

  immunizations: {
    tt1: Date,
    tt2: Date,
    tt3: Date,
    tdap: Date,
    flu: Date,
    hpv: Date,
    pcv: Date,
    covid19: {
      brand: String,
      primary: Date,
      booster: Date
    }
  },
  
  // Consultation Records from form
  consultations: [{
    date: { type: Date, default: Date.now },
    // Vitals
    bp: { type: String, trim: true }, // Blood Pressure
    pr: { type: String, trim: true }, // Pulse Rate
    rr: { type: String, trim: true }, // Respiratory Rate
    temp: { type: String, trim: true }, // Temperature
    weight: { type: String, trim: true },
    bmi: { type: String, trim: true },
    aog: { type: String, trim: true }, // Age of Gestation (per visit)
    fh: { type: String, trim: true }, // Fundal Height
    fht: { type: String, trim: true }, // Fetal Heart Tone
    internalExam: { type: String, trim: true },

    // Subjective / Objective
    historyPhysicalExam: { type: String, trim: true },
    
    // Assessment / Plan
    assessmentPlan: { type: String, trim: true },
    
    // Next Appointment
    nextAppointment: { type: Date }
  }]
});

const patientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    unique: true,
    required: true
  },
  patientNumber: {
    type: String,
    unique: true,
    sparse: true  // This allows null values but ensures uniqueness for non-null values
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

// Auto-generate patient ID and patientNumber
patientSchema.pre('validate', async function() {
  if (!this.patientId && !this._generatingId) {
    this._generatingId = true; // Prevent multiple calls
    console.log(`Generating patient ID for ${this.patientType} patient...`);
    
    try {
      const prefix = this.patientType === 'pediatric' ? 'PED' : 'OBG';
      
      // Find the highest existing number for this patient type to start from
      const lastPatient = await this.constructor.findOne(
        { 
          patientType: this.patientType,
          patientId: { $regex: `^${prefix}` }
        },
        { patientId: 1 }
      ).sort({ patientId: -1 });
      
      let nextNumber = 1;
      if (lastPatient && lastPatient.patientId) {
        // Extract the number from the last patient ID (e.g., "OBG000003" -> 3)
        const lastNumber = parseInt(lastPatient.patientId.substring(3));
        nextNumber = lastNumber + 1;
      }
      
      let attempts = 0;
      const maxAttempts = 100;
      
      while (attempts < maxAttempts) {
        const candidateId = `${prefix}${String(nextNumber).padStart(6, '0')}`;
        console.log(`Trying candidate ID: ${candidateId} (attempt ${attempts + 1})`);
        
        // Check if this ID already exists
        const existing = await this.constructor.findOne({ patientId: candidateId });
        if (!existing) {
          console.log(`ID ${candidateId} is available, assigning to patient`);
          this.patientId = candidateId;
          this.patientNumber = candidateId;
          break;
        } else {
          console.log(`ID ${candidateId} already exists, trying next number`);
        }
        
        nextNumber++;
        attempts++;
      }
      
      if (!this.patientId) {
        const errorMsg = `Failed to generate unique patient ID after ${attempts} attempts`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log(`Successfully assigned patient ID: ${this.patientId}`);
    } finally {
      this._generatingId = false;
    }
  }
});

// Index for search
patientSchema.index({ 
  patientId: 1,
  'pediatricRecord.patientName': 'text',
  'pediatricRecord.nameOfMother': 'text',
  'obGyneRecord.patientName': 'text'
});

export default mongoose.model('Patient', patientSchema); 