import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
  appointmentId: {
    type: String,
    unique: true,
    required: true
  },
  
  // Patient information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: function() {
      return this.bookingSource !== 'patient_portal';
    }
  },
  
  // Doctor/Service information
  doctorType: {
    type: String,
    enum: ['ob-gyne', 'pediatric'],
    required: true
  },
  
  doctorName: {
    type: String,
    required: true,
    enum: ['Dr. Maria Sarah L. Manaloto', 'Dr. Shara Laine S. Vino']
  },
  
  // Appointment scheduling
  appointmentDate: {
    type: Date,
    required: true
  },
  
  appointmentTime: {
    type: String,
    required: true,
    validate: {
      validator: function(time) {
        // Validate time format (HH:MM AM/PM)
        return /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i.test(time);
      },
      message: 'Time must be in format HH:MM AM/PM'
    }
  },
  
  // Service details
  serviceType: {
    type: String,
    required: true,
    enum: [
      // OB-GYNE Services
      'PRENATAL_CHECKUP',
      'POSTNATAL_CHECKUP', 
      'CHILDBIRTH_CONSULTATION',
      'DILATATION_CURETTAGE',
      'FAMILY_PLANNING',
      'PAP_SMEAR',
      'WOMEN_VACCINATION',
      'PCOS_CONSULTATION',
      'STI_CONSULTATION',
      'INFERTILITY_CONSULTATION',
      'MENOPAUSE_CONSULTATION',
      
      // Pediatric Services
      'NEWBORN_CONSULTATION',
      'WELL_BABY_CHECKUP',
      'WELL_CHILD_CHECKUP',
      'PEDIATRIC_EVALUATION',
      'CHILD_VACCINATION',
      'EAR_PIERCING',
      'PEDIATRIC_REFERRAL'
    ]
  },
  
  // Appointment status
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show', 'rescheduled', 'cancellation_pending', 'reschedule_pending'],
    default: 'scheduled'
  },
  
  // Priority and type
  appointmentType: {
    type: String,
    enum: ['regular', 'follow-up', 'emergency', 'walk-in'],
    default: 'regular'
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Contact information
  contactInfo: {
    primaryPhone: { type: String, required: true },
    alternatePhone: { type: String },
    email: { type: String, lowercase: true }
  },
  
  // Appointment details
  reasonForVisit: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  symptoms: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  // Follow-up information
  isFollowUp: {
    type: Boolean,
    default: false
  },
  
  previousAppointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  
  nextFollowUp: {
    type: Date
  },
  
  // Staff information
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Patient portal booking info
  patientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PatientUser'
  },

  patientName: {
    type: String,
    required: true
  },

  contactNumber: {
    type: String,
    required: true
  },

  patientType: {
    type: String,
    enum: ['self', 'dependent'],
    default: 'self'
  },

  dependentInfo: {
    name: String,
    relationship: String,
    age: Number,
    dateOfBirth: Date
  },

  bookingSource: {
    type: String,
    enum: ['staff', 'patient_portal'],
    default: 'staff'
  },
  
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Notes and instructions
  staffNotes: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  
  patientInstructions: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Cancellation/Rescheduling
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Cancellation request (requires admin approval)
  cancellationRequest: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    requestedAt: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientUser'
    },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  // Reschedule request (requires admin approval)
  rescheduleRequest: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500
    },
    requestedAt: Date,
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientUser'
    },
    preferredDate: Date,
    preferredTime: String,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  
  rescheduledFrom: {
    originalDate: Date,
    originalTime: String,
    reason: String
  },
  
  // Queue management
  queueNumber: {
    type: Number
  },
  
  estimatedWaitTime: {
    type: Number // in minutes
  }
}, {
  timestamps: true
});

// Generate appointment ID
appointmentSchema.pre('save', async function(next) {
  if (!this.appointmentId) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
        $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
      }
    });
    this.appointmentId = `APT${dateStr}${String(count + 1).padStart(3, '0')}`;
  }
  next();
});

// Validate appointment time against doctor schedules
appointmentSchema.pre('save', function(next) {
  const appointmentDate = new Date(this.appointmentDate);
  const dayOfWeek = appointmentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const schedules = {
    'Dr. Maria Sarah L. Manaloto': {
      1: { start: '08:00 AM', end: '12:00 PM' }, // Monday
      3: { start: '09:00 AM', end: '02:00 PM' }, // Wednesday  
      5: { start: '01:00 PM', end: '05:00 PM' }  // Friday
    },
    'Dr. Shara Laine S. Vino': {
      1: { start: '01:00 PM', end: '05:00 PM' }, // Monday
      2: { start: '01:00 PM', end: '05:00 PM' }, // Tuesday
      4: { start: '08:00 AM', end: '12:00 PM' }  // Thursday
    }
  };
  
  const doctorSchedule = schedules[this.doctorName];
  if (doctorSchedule && !doctorSchedule[dayOfWeek]) {
    return next(new Error(`${this.doctorName} is not available on this day`));
  }
  
  next();
});

// Indexes for efficient querying
appointmentSchema.index({ appointmentDate: 1, doctorName: 1 });
appointmentSchema.index({ patient: 1 });
appointmentSchema.index({ status: 1 });

export default mongoose.model('Appointment', appointmentSchema); 