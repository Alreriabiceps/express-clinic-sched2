import express from 'express';
import { body, validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import PatientUser from '../models/PatientUser.js';
import Settings from '../models/Settings.js';
import { authenticatePatient } from '../middleware/patientAuth.js';

const router = express.Router();

// Get available dates for a specific doctor
router.get('/available-dates', async (req, res) => {
  try {
    const { doctorId } = req.query;

    console.log('Available dates request for doctorId:', doctorId);

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }

    // Fetch settings for dynamic doctor schedules
    const settings = await Settings.getSettings();
    
    // Map settings to doctorSchedules format
    // Using simple IDs 'doc_1' and 'doc_2' for now to match frontend expectations
    // Ideally frontend should use real IDs or names
    const doctorSchedules = {
      'doc_1': {
        name: settings.obgyneDoctor.name,
        specialty: 'ob-gyne',
        schedule: {
          'Monday': settings.obgyneDoctor.hours.monday.enabled ? settings.obgyneDoctor.hours.monday : null,
          'Tuesday': settings.obgyneDoctor.hours.tuesday.enabled ? settings.obgyneDoctor.hours.tuesday : null,
          'Wednesday': settings.obgyneDoctor.hours.wednesday.enabled ? settings.obgyneDoctor.hours.wednesday : null,
          'Thursday': settings.obgyneDoctor.hours.thursday.enabled ? settings.obgyneDoctor.hours.thursday : null,
          'Friday': settings.obgyneDoctor.hours.friday.enabled ? settings.obgyneDoctor.hours.friday : null,
          'Saturday': settings.obgyneDoctor.hours.saturday.enabled ? settings.obgyneDoctor.hours.saturday : null,
          'Sunday': settings.obgyneDoctor.hours.sunday.enabled ? settings.obgyneDoctor.hours.sunday : null,
        }
      },
      'doc_2': {
        name: settings.pediatrician.name,
        specialty: 'pediatric',
        schedule: {
          'Monday': settings.pediatrician.hours.monday.enabled ? settings.pediatrician.hours.monday : null,
          'Tuesday': settings.pediatrician.hours.tuesday.enabled ? settings.pediatrician.hours.tuesday : null,
          'Wednesday': settings.pediatrician.hours.wednesday.enabled ? settings.pediatrician.hours.wednesday : null,
          'Thursday': settings.pediatrician.hours.thursday.enabled ? settings.pediatrician.hours.thursday : null,
          'Friday': settings.pediatrician.hours.friday.enabled ? settings.pediatrician.hours.friday : null,
          'Saturday': settings.pediatrician.hours.saturday.enabled ? settings.pediatrician.hours.saturday : null,
          'Sunday': settings.pediatrician.hours.sunday.enabled ? settings.pediatrician.hours.sunday : null,
        }
      }
    };

    const doctor = doctorSchedules[doctorId];
    console.log('Found doctor:', doctor ? doctor.name : 'NOT FOUND');
    console.log('Doctor schedule:', doctor ? doctor.schedule : 'NO SCHEDULE');

    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Get the next 90 days
    const availableDates = [];
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 90); // 3 months ahead

    // Start from tomorrow
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + 1);

    while (checkDate <= maxDate) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayOfWeek = dayNames[checkDate.getDay()];

      // Check if doctor works on this day
      if (doctor.schedule[dayOfWeek]) {
        // Fix timezone issue by using local date formatting
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const day = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        availableDates.push(dateStr);
        console.log(`Adding available date: ${dateStr} (${dayOfWeek})`);
      }

      // Move to next day
      checkDate.setDate(checkDate.getDate() + 1);
    }

    console.log(`Total available dates for ${doctor.name}: ${availableDates.length}`);

    res.json({
      success: true,
      data: {
        availableDates,
        doctorInfo: {
          name: doctor.name,
          specialty: doctor.specialty,
          workingDays: Object.keys(doctor.schedule)
        }
      }
    });

  } catch (error) {
    console.error('Available dates error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving available dates'
    });
  }
});

// Get available time slots for a specific date and doctor
router.get('/available-slots', async (req, res) => {
  try {
    const { date, doctorId } = req.query;

    console.log('Available slots request:', { date, doctorId });

    if (!date || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Date and doctor ID are required'
      });
    }

    // Fetch settings for dynamic doctor schedules
    const settings = await Settings.getSettings();
    
    // Map settings to doctorSchedules format
    const doctorSchedules = {
      'doc_1': {
        name: settings.obgyneDoctor.name,
        specialty: 'ob-gyne',
        schedule: {
          'Monday': settings.obgyneDoctor.hours.monday.enabled ? settings.obgyneDoctor.hours.monday : null,
          'Tuesday': settings.obgyneDoctor.hours.tuesday.enabled ? settings.obgyneDoctor.hours.tuesday : null,
          'Wednesday': settings.obgyneDoctor.hours.wednesday.enabled ? settings.obgyneDoctor.hours.wednesday : null,
          'Thursday': settings.obgyneDoctor.hours.thursday.enabled ? settings.obgyneDoctor.hours.thursday : null,
          'Friday': settings.obgyneDoctor.hours.friday.enabled ? settings.obgyneDoctor.hours.friday : null,
          'Saturday': settings.obgyneDoctor.hours.saturday.enabled ? settings.obgyneDoctor.hours.saturday : null,
          'Sunday': settings.obgyneDoctor.hours.sunday.enabled ? settings.obgyneDoctor.hours.sunday : null,
        }
      },
      'doc_2': {
        name: settings.pediatrician.name,
        specialty: 'pediatric',
        schedule: {
          'Monday': settings.pediatrician.hours.monday.enabled ? settings.pediatrician.hours.monday : null,
          'Tuesday': settings.pediatrician.hours.tuesday.enabled ? settings.pediatrician.hours.tuesday : null,
          'Wednesday': settings.pediatrician.hours.wednesday.enabled ? settings.pediatrician.hours.wednesday : null,
          'Thursday': settings.pediatrician.hours.thursday.enabled ? settings.pediatrician.hours.thursday : null,
          'Friday': settings.pediatrician.hours.friday.enabled ? settings.pediatrician.hours.friday : null,
          'Saturday': settings.pediatrician.hours.saturday.enabled ? settings.pediatrician.hours.saturday : null,
          'Sunday': settings.pediatrician.hours.sunday.enabled ? settings.pediatrician.hours.sunday : null,
        }
      }
    };

    const doctor = doctorSchedules[doctorId];
    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Get day of week for the selected date - FIXED TIMEZONE ISSUE
    const selectedDate = new Date(date + 'T12:00:00'); // Add time to avoid timezone issues
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[selectedDate.getDay()];

    console.log('Date info:', { selectedDate, dayOfWeek, schedule: doctor.schedule });

    // Check if doctor works on this day
    if (!doctor.schedule[dayOfWeek]) {
      console.log(`Doctor ${doctor.name} not available on ${dayOfWeek}`);
      return res.json({
        success: true,
        data: {
          availableSlots: [],
          message: `${doctor.name} is not available on ${dayOfWeek}s`
        }
      });
    }

    // Generate time slots (30-minute intervals)
    const { start, end } = doctor.schedule[dayOfWeek];
    console.log('Generating slots for:', { start, end, dayOfWeek });
    const timeSlots = generateTimeSlots(start, end, 30);
    console.log('Generated time slots:', timeSlots);

    // Get existing CONFIRMED appointments for this date and doctor
    // Only confirmed appointments block the slot - scheduled ones are still available for booking
    const confirmedAppointments = await Appointment.find({
      appointmentDate: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      doctorName: doctor.name,
      status: 'confirmed' // Only block if confirmed, not scheduled
    });

    // Get SCHEDULED appointments to show count of pending bookings
    const scheduledAppointments = await Appointment.find({
      appointmentDate: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      doctorName: doctor.name,
      status: 'scheduled' // Count scheduled appointments
    });

    console.log('Existing confirmed appointments:', confirmedAppointments.length);
    console.log('Existing scheduled appointments:', scheduledAppointments.length);

    // Filter out booked slots (only confirmed ones)
    const bookedTimes = confirmedAppointments.map(apt => apt.appointmentTime);
    const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));

    // Count scheduled appointments per time slot
    const scheduledCounts = {};
    scheduledAppointments.forEach(apt => {
      const time = apt.appointmentTime;
      scheduledCounts[time] = (scheduledCounts[time] || 0) + 1;
    });

    // Create slots with booking count information
    const slotsWithCounts = availableSlots.map(slot => ({
      time: slot,
      scheduledCount: scheduledCounts[slot] || 0
    }));

    console.log('Available slots with counts:', slotsWithCounts);

    res.json({
      success: true,
      data: {
        slots: availableSlots, // Keep backward compatibility
        slotsWithCounts: slotsWithCounts, // New format with counts
        doctorInfo: {
          name: doctor.name,
          specialty: doctor.specialty,
          workingHours: `${start} - ${end}`
        }
      }
    });

  } catch (error) {
    console.error('Available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving available slots'
    });
  }
});

// Get all available doctors and their schedules
router.get('/doctors', async (req, res) => {
  try {
    const settings = await Settings.getSettings();

    // Helper to format schedule string
    const formatSchedule = (hours) => {
      const schedule = {};
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(day => {
        if (hours[day] && hours[day].enabled) {
          const dayName = day.charAt(0).toUpperCase() + day.slice(1);
          schedule[dayName] = `${hours[day].start} - ${hours[day].end}`;
        }
      });
      return schedule;
    };

    // Helper to get working days
    const getWorkingDays = (hours) => {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      return days
        .filter(day => hours[day] && hours[day].enabled)
        .map(day => day.charAt(0).toUpperCase() + day.slice(1));
    };

    const doctors = [
      {
        _id: 'doc_1',
        name: settings.obgyneDoctor.name,
        specialty: 'OB-GYNE',
        specialtyCode: 'ob-gyne',
        description: 'Obstetrics and Gynecology specialist',
        schedule: formatSchedule(settings.obgyneDoctor.hours),
        workingDays: getWorkingDays(settings.obgyneDoctor.hours)
      },
      {
        _id: 'doc_2',
        name: settings.pediatrician.name,
        specialty: 'Pediatric',
        specialtyCode: 'pediatric',
        description: 'Pediatrics specialist for children and infants',
        schedule: formatSchedule(settings.pediatrician.hours),
        workingDays: getWorkingDays(settings.pediatrician.hours)
      }
    ];

    res.json({
      success: true,
      data: { doctors }
    });

  } catch (error) {
    console.error('Doctors list error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving doctors list'
    });
  }
});

// Book an appointment
router.post('/book-appointment', authenticatePatient, [
  body('doctorName').notEmpty().withMessage('Doctor name is required'),
  body('appointmentDate').isISO8601().withMessage('Valid appointment date is required'),
  body('appointmentTime').notEmpty().withMessage('Appointment time is required'),
  body('serviceType').notEmpty().withMessage('Service type is required'),
  body('reasonForVisit').optional().trim(),
  body('patientType').isIn(['self', 'dependent']).withMessage('Patient type must be self or dependent'),
  body('dependentInfo').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      doctorName,
      appointmentDate,
      appointmentTime,
      serviceType,
      reasonForVisit,
      patientType,
      dependentInfo
    } = req.body;

    // Get patient user info from authenticated request
    const patientUser = await PatientUser.findById(req.patient.id);

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient account not found'
      });
    }

    // Check if slot is already confirmed by another patient
    // Allow multiple "scheduled" appointments - they'll compete for confirmation
    const confirmedAppointment = await Appointment.findOne({
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      doctorName,
      status: 'confirmed'
    });

    if (confirmedAppointment) {
      return res.status(400).json({
        success: false,
        message: 'This time slot has already been confirmed for another patient'
      });
    }

    // Determine patient info based on type
    let patientName, contactNumber, patientId;

    if (patientType === 'self') {
      patientName = patientUser.fullName;
      contactNumber = patientUser.phoneNumber;
      patientId = patientUser._id.toString();
    } else {
      // For dependent (child, spouse, etc.)
      if (!dependentInfo || !dependentInfo.name || !dependentInfo.relationship) {
        return res.status(400).json({
          success: false,
          message: 'Dependent information is required for dependent appointments'
        });
      }
      patientName = dependentInfo.name;
      contactNumber = patientUser.phoneNumber; // Use account holder's contact
      patientId = `${patientUser._id}-${dependentInfo.name.replace(/\s+/g, '')}`; // Generate dependent ID
    }

    // Generate appointment ID
    const appointmentCount = await Appointment.countDocuments();
    const appointmentId = `APT${String(appointmentCount + 1).padStart(6, '0')}`;

    // Fetch settings for dynamic doctor names
    const settings = await Settings.getSettings();

    // Map specialty to doctorType and serviceType
    const doctorSchedules = {
      [settings.obgyneDoctor.name]: {
        doctorType: 'ob-gyne',
        defaultServiceType: 'PRENATAL_CHECKUP'
      },
      [settings.pediatrician.name]: {
        doctorType: 'pediatric',
        defaultServiceType: 'WELL_CHILD_CHECKUP'
      }
    };

    const doctorInfo = doctorSchedules[doctorName];
    if (!doctorInfo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor selected'
      });
    }

    // Find or create patient record linked to PatientUser
    let patientRecord = await Patient.findOne({
      'contactInfo.email': patientUser.email
    });

    if (!patientRecord) {
      // Create new patient record with status 'New'
      const patientData = {
        patientType: doctorInfo.doctorType,
        contactInfo: {
          email: patientUser.email,
          emergencyContact: patientUser.emergencyContact || {}
        },
        status: 'New' // Set initial status as 'New' when booking appointment
      };

      if (doctorInfo.doctorType === 'pediatric') {
        patientData.pediatricRecord = {
          nameOfMother: patientType === 'self' ? '' : patientUser.fullName, // If booking for dependent, parent is the mother
          nameOfFather: '',
          nameOfChildren: patientType === 'dependent' ? dependentInfo?.name || '' : patientUser.fullName,
          address: `${patientUser.address?.street || ''}, ${patientUser.address?.city || ''}, ${patientUser.address?.province || ''}`.trim() || 'Not provided',
          contactNumber: patientUser.phoneNumber,
          birthDate: patientType === 'dependent' && dependentInfo?.age
            ? new Date(new Date().getFullYear() - dependentInfo.age, 0, 1)
            : patientUser.dateOfBirth,
          immunizations: [],
          consultations: []
        };
      } else {
        // For OB-GYNE patients, ensure patientName is set (required field)
        const patientName = patientType === 'dependent' ? dependentInfo?.name : patientUser.fullName;
        if (!patientName) {
          throw new Error('Patient name is required for OB-GYNE records');
        }

        patientData.obGyneRecord = {
          patientName: patientName,
          address: `${patientUser.address?.street || ''}, ${patientUser.address?.city || ''}, ${patientUser.address?.province || ''}`.trim() || 'Not provided',
          contactNumber: patientUser.phoneNumber,
          birthDate: patientType === 'dependent' && dependentInfo?.age
            ? new Date(new Date().getFullYear() - dependentInfo.age, 0, 1)
            : patientUser.dateOfBirth,
          civilStatus: 'Single', // Default value, can be updated later
          occupation: '',
          pastMedicalHistory: {
            hypertension: false,
            diabetes: false,
            heartDisease: false,
            asthma: false,
            allergies: '',
            medications: '',
            surgeries: '',
            other: ''
          },
          obstetricHistory: [],
          gynecologicHistory: {
            menstrualCycle: '',
            contraceptiveUse: '',
            gravida: 0,
            para: 0,
            abortions: 0
          },
          consultations: []
        };
      }

      try {
        // Manually generate patientId before creating the record
        const prefix = doctorInfo.doctorType === 'pediatric' ? 'PED' : 'OBG';
        const count = await Patient.countDocuments({ patientType: doctorInfo.doctorType });
        const generatedPatientId = `${prefix}${String(count + 1).padStart(6, '0')}`;

        patientData.patientId = generatedPatientId;
        console.log('Creating patient with generated patientId:', generatedPatientId);

        patientRecord = new Patient(patientData);
        await patientRecord.save();
        console.log('Patient saved successfully with patientId:', patientRecord.patientId);
      } catch (patientError) {
        console.error('Error creating patient record:', patientError);
        throw new Error(`Failed to create patient record: ${patientError.message}`);
      }

      // Link patient record to PatientUser
      patientUser.patientRecord = patientRecord._id;
      await patientUser.save();
    } else {
      // Update existing patient record status to 'New' if it was 'Inactive'
      if (patientRecord.status === 'Inactive') {
        patientRecord.status = 'New';
        await patientRecord.save();
      }
    }

    if (patientRecord?.appointmentLocked) {
      return res.status(403).json({
        success: false,
        message: 'Booking is locked due to multiple no-shows. Please contact the clinic to unlock.',
        data: {
          noShowCount: patientRecord.noShowCount || 0
        }
      });
    }

    // Create appointment with all required fields
    const appointment = new Appointment({
      appointmentId,
      patient: patientRecord._id, // Link to patient record
      patientUserId: patientUser._id,
      doctorType: doctorInfo.doctorType,
      doctorName,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      serviceType: doctorInfo.defaultServiceType, // Always use the correct default service type
      contactInfo: {
        primaryPhone: patientUser.phoneNumber,
        email: patientUser.email
      },
      patientName,
      contactNumber: patientUser.phoneNumber,
      patientType,
      dependentInfo: patientType === 'dependent' ? dependentInfo : undefined,
      reasonForVisit: reasonForVisit || 'General consultation',
      status: 'scheduled',
      bookingSource: 'patient_portal'
    });

    await appointment.save();

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.emit('appointment:created', {
        type: 'appointment_created',
        message: `New appointment booked by ${appointment.patientName}`,
        data: {
          id: appointment._id,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          serviceType: appointment.serviceType,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime
        }
      });
    }

    // Return appointment details
    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        appointment: {
          appointmentId: appointment.appointmentId,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          appointmentDate: appointment.appointmentDate,
          appointmentTime: appointment.appointmentTime,
          serviceType: appointment.serviceType,
          reasonForVisit: appointment.reasonForVisit,
          status: appointment.status,
          patientType: appointment.patientType,
          dependentInfo: appointment.dependentInfo
        }
      }
    });

  } catch (error) {
    console.error('Book appointment error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({
      success: false,
      message: 'Error booking appointment',
      error: error.message // Always return error message for now to debug
    });
  }
});

// Get patient's appointments
router.get('/my-appointments', authenticatePatient, async (req, res) => {
  try {
    const appointments = await Appointment.find({
      patientUserId: req.patient.id
    }).sort({ appointmentDate: -1, appointmentTime: -1 });

    res.json({
      success: true,
      data: { appointments }
    });

  } catch (error) {
    console.error('My appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving appointments'
    });
  }
});

// Cancel appointment
router.put('/cancel-appointment/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({
      appointmentId,
      patientUserId: req.patient.id
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled'
      });
    }

    // Check if appointment is in the future (allow cancellation up to 2 hours before)
    const appointmentDateTime = new Date(`${appointment.appointmentDate.toISOString().split('T')[0]}T${convertTo24Hour(appointment.appointmentTime)}`);
    const now = new Date();
    const timeDifference = appointmentDateTime.getTime() - now.getTime();
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    if (hoursDifference < 2) {
      return res.status(400).json({
        success: false,
        message: 'Appointments can only be cancelled at least 2 hours in advance'
      });
    }

    appointment.status = 'cancelled';
    appointment.updatedAt = new Date();
    await appointment.save();

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.emit('appointment:cancelled', {
        type: 'appointment_cancelled',
        message: `Appointment cancelled by ${appointment.patientName}`,
        data: {
          id: appointment._id,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime
        }
      });
    }

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Cancel appointment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment'
    });
  }
});

// Request cancellation (requires admin approval)
router.post('/request-cancellation/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const appointment = await Appointment.findOne({
      appointmentId,
      patientUserId: req.patient.id
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is already cancelled'
      });
    }

    if (appointment.status === 'cancellation_pending') {
      return res.status(400).json({
        success: false,
        message: 'Cancellation request is already pending'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed appointment'
      });
    }

    // Check if appointment is in the future (allow cancellation up to 2 hours before)
    const appointmentDateTime = new Date(`${appointment.appointmentDate.toISOString().split('T')[0]}T${convertTo24Hour(appointment.appointmentTime)}`);
    const now = new Date();
    const timeDifference = appointmentDateTime.getTime() - now.getTime();
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    if (hoursDifference < 2) {
      return res.status(400).json({
        success: false,
        message: 'Appointments can only be cancelled at least 2 hours in advance'
      });
    }

    // Create cancellation request
    appointment.status = 'cancellation_pending';
    appointment.cancellationRequest = {
      status: 'pending',
      reason: reason.trim(),
      requestedAt: new Date(),
      requestedBy: req.patient.id,
      previousStatus: appointment.status
    };
    appointment.updatedAt = new Date();
    
    await appointment.save();

    // Emit socket event for real-time notification
    if (req.io) {
      req.io.emit('appointment:cancellation_requested', {
        type: 'cancellation_requested',
        message: `Cancellation request submitted for appointment with ${appointment.patientName}`,
        data: {
          id: appointment._id,
          appointmentId: appointment.appointmentId,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          date: appointment.appointmentDate,
          time: appointment.appointmentTime
        }
      });
    }

    res.json({
      success: true,
      message: 'Cancellation request submitted successfully. Please wait for admin approval.',
      data: { appointment }
    });

  } catch (error) {
    console.error('Request cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting cancellation request',
      error: error.message
    });
  }
});

// Request reschedule (patient-initiated)
router.post('/request-reschedule/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTime, reason, preferredDate, preferredTime } = req.body;

    // Allow frontend to send either newDate/newTime or preferredDate/preferredTime
    const dateToUse = newDate || preferredDate;
    const timeToUse = newTime || preferredTime;

    // Try to find by _id first, then by appointmentId
    let appointment = await Appointment.findOne({
      _id: appointmentId,
      patientUserId: req.patient.id
    }).catch(() => null);

    if (!appointment) {
      appointment = await Appointment.findOne({
        appointmentId: appointmentId,
        patientUserId: req.patient.id
      });
    }

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reschedule a cancelled or completed appointment'
      });
    }

    let parsedDate = null;

    // Only validate and check conflicts if a date is provided
    if (dateToUse && timeToUse) {
      // Parse the new date
      const [year, month, day] = dateToUse.split('-');
      parsedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));

      // Check for conflicts
      const existingAppointment = await Appointment.findOne({
        _id: { $ne: appointment._id },
        doctorName: appointment.doctorName,
        appointmentDate: parsedDate,
        appointmentTime: timeToUse,
        status: { $in: ["scheduled", "confirmed", "reschedule_pending"] },
      });

      if (existingAppointment) {
        return res.status(400).json({
          success: false,
          message: 'The requested time slot is already booked'
        });
      }
    }

    // Create reschedule request
    appointment.rescheduleRequest = {
      status: 'pending',
      reason: reason || 'Patient requested reschedule',
      requestedAt: new Date(),
      preferredDate: parsedDate,
      preferredTime: timeToUse,
      requestedBy: req.patient.id
    };
    appointment.status = 'reschedule_pending';
    appointment.updatedAt = new Date();
    
    await appointment.save();

    // Emit socket event
    if (req.io) {
      req.io.emit('appointment:reschedule_requested', {
        type: 'reschedule_requested',
        message: `Reschedule request submitted for appointment with ${appointment.patientName}`,
        data: {
          id: appointment._id,
          appointmentId: appointment.appointmentId,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName
        }
      });
    }

    res.json({
      success: true,
      message: 'Reschedule request submitted successfully. Please wait for admin approval.',
      data: { appointment }
    });

  } catch (error) {
    console.error('Request reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting reschedule request',
      error: error.message
    });
  }
});

// Accept reschedule (patient accepts staff-initiated reschedule)
router.post('/accept-reschedule/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientUserId: req.patient.id
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (!appointment.rescheduleRequest || appointment.rescheduleRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending reschedule request found for this appointment'
      });
    }

    // Apply the reschedule
    appointment.appointmentDate = appointment.rescheduleRequest.preferredDate;
    appointment.appointmentTime = appointment.rescheduleRequest.preferredTime;
    appointment.status = 'confirmed';
    appointment.rescheduleRequest.status = 'approved';
    appointment.rescheduleRequest.reviewedAt = new Date();
    appointment.updatedAt = new Date();
    
    await appointment.save();

    // Emit socket event
    if (req.io) {
      req.io.emit('appointment:reschedule_accepted', {
        type: 'reschedule_accepted',
        message: `Reschedule accepted for appointment with ${appointment.patientName}`,
        data: {
          id: appointment._id,
          appointmentId: appointment.appointmentId,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName,
          newDate: appointment.appointmentDate,
          newTime: appointment.appointmentTime
        }
      });
    }

    res.json({
      success: true,
      message: 'Reschedule accepted successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Accept reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting reschedule',
      error: error.message
    });
  }
});

// Cancel reschedule (patient rejects staff-initiated reschedule)
router.post('/cancel-reschedule/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientUserId: req.patient.id
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (!appointment.rescheduleRequest || appointment.rescheduleRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'No pending reschedule request found for this appointment'
      });
    }

    // Reject the reschedule - revert to original status
    appointment.rescheduleRequest.status = 'rejected';
    appointment.rescheduleRequest.rejectedAt = new Date();
    
    // Revert to original date/time if stored
    if (appointment.rescheduledFrom) {
      appointment.appointmentDate = appointment.rescheduledFrom.originalDate;
      appointment.appointmentTime = appointment.rescheduledFrom.originalTime;
    }
    
    appointment.status = 'scheduled'; // Revert to scheduled
    appointment.updatedAt = new Date();
    
    await appointment.save();

    // Emit socket event
    if (req.io) {
      req.io.emit('appointment:reschedule_rejected', {
        type: 'reschedule_rejected',
        message: `Reschedule rejected for appointment with ${appointment.patientName}`,
        data: {
          id: appointment._id,
          appointmentId: appointment.appointmentId,
          patientName: appointment.patientName,
          doctorName: appointment.doctorName
        }
      });
    }

    res.json({
      success: true,
      message: 'Reschedule request rejected. Appointment remains at original time.',
      data: { appointment }
    });

  } catch (error) {
    console.error('Cancel reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting reschedule',
      error: error.message
    });
  }
});

// Helper function to generate time slots
function generateTimeSlots(startTime, endTime, intervalMinutes = 30) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  for (let minutes = startMinutes; minutes < endMinutes; minutes += intervalMinutes) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;

    let displayHour = hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';

    if (hour > 12) displayHour = hour - 12;
    if (hour === 0) displayHour = 12;

    const timeString = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
    slots.push(timeString);
  }

  return slots;
}

// Helper function to convert 12-hour format to 24-hour format
function convertTo24Hour(time12h) {
  const [time, modifier] = time12h.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') {
    hours = '00';
  }
  if (modifier === 'PM') {
    hours = parseInt(hours, 10) + 12;
  }
  return `${hours}:${minutes}:00`;
}

export default router; 