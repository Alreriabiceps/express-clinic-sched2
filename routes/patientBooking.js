import express from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import PatientUser from '../models/PatientUser.js';
import Settings from '../models/Settings.js';
import { authenticatePatient } from '../middleware/patientAuth.js';

const router = express.Router();

// Day names constant (reusable across functions)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper function to get clinic settings
const getClinicSettings = async () => {
  return await Settings.getSettings();
};

// Helper function to convert clinic settings to doctor format
const convertSettingsToDoctors = (settings) => {
  const formatSchedule = (hours) => {
    const schedule = {};
    const workingDays = [];
    
    Object.keys(hours).forEach(day => {
      const dayData = hours[day];
      if (dayData.enabled && dayData.start && dayData.end) {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        
        // Convert 24-hour format to 12-hour format for display
        const formatTime = (time24) => {
          const [hours, minutes] = time24.split(':');
          const hour = parseInt(hours);
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const displayHour = hour % 12 || 12;
          return `${displayHour}:${minutes} ${ampm}`;
        };
        
        schedule[dayName] = `${formatTime(dayData.start)} - ${formatTime(dayData.end)}`;
        workingDays.push(dayName);
      }
    });
    
    return { schedule, workingDays };
  };

  const obgyneSchedule = formatSchedule(settings.obgyneDoctor.hours);
  const pediatricSchedule = formatSchedule(settings.pediatrician.hours);

  return [
    {
      _id: 'doc_1',
      name: settings.obgyneDoctor.name,
      specialty: 'OB-GYNE',
      specialtyCode: 'ob-gyne',
      description: 'Obstetrics and Gynecology specialist',
      schedule: obgyneSchedule.schedule,
      workingDays: obgyneSchedule.workingDays
    },
    {
      _id: 'doc_2',
      name: settings.pediatrician.name,
      specialty: 'Pediatric',
      specialtyCode: 'pediatric',
      description: 'Pediatrics specialist for children and infants',
      schedule: pediatricSchedule.schedule,
      workingDays: pediatricSchedule.workingDays
    }
  ];
};

// Get available dates for a specific doctor
router.get('/available-dates', async (req, res) => {
  try {
    const { doctorId } = req.query;
    
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Doctor ID is required'
      });
    }

    // Get clinic settings
    const settings = await getClinicSettings();
    const doctors = convertSettingsToDoctors(settings);
    
    const doctor = doctors.find(d => d._id === doctorId);
    
    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Convert doctor schedule to the format needed for date checking
    const schedule = {};
    
    Object.keys(settings[doctorId === 'doc_1' ? 'obgyneDoctor' : 'pediatrician'].hours).forEach(day => {
      const dayData = settings[doctorId === 'doc_1' ? 'obgyneDoctor' : 'pediatrician'].hours[day];
      if (dayData.enabled && dayData.start && dayData.end) {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        schedule[dayName] = { start: dayData.start, end: dayData.end };
      }
    });

    // Create doctor object with schedule for compatibility
    const doctorWithSchedule = {
      name: doctor.name,
      specialty: doctor.specialtyCode,
      schedule: schedule
    };

    // Get the next 90 days
    const availableDates = [];
    const today = new Date();
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 90); // 3 months ahead

    // Start from tomorrow
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + 1);

    while (checkDate <= maxDate) {
      const dayOfWeek = DAY_NAMES[checkDate.getDay()];
      
      // Check if doctor works on this day
      if (doctorWithSchedule.schedule[dayOfWeek]) {
        // Fix timezone issue by using local date formatting
        const year = checkDate.getFullYear();
        const month = String(checkDate.getMonth() + 1).padStart(2, '0');
        const day = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        availableDates.push(dateStr);
      }
      
      // Move to next day
      checkDate.setDate(checkDate.getDate() + 1);
    }



    res.json({
      success: true,
      data: {
        availableDates,
        doctorInfo: {
          name: doctorWithSchedule.name,
          specialty: doctorWithSchedule.specialty,
          workingDays: Object.keys(doctorWithSchedule.schedule)
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
    
    if (!date || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Date and doctor ID are required'
      });
    }

    // Get clinic settings
    const settings = await getClinicSettings();
    const doctors = convertSettingsToDoctors(settings);
    
    const doctor = doctors.find(d => d._id === doctorId);
    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Get doctor schedule from settings
    const doctorSettings = doctorId === 'doc_1' ? settings.obgyneDoctor : settings.pediatrician;
    const schedule = {};
    
    Object.keys(doctorSettings.hours).forEach(day => {
      const dayData = doctorSettings.hours[day];
      if (dayData.enabled && dayData.start && dayData.end) {
        const dayName = day.charAt(0).toUpperCase() + day.slice(1);
        schedule[dayName] = { start: dayData.start, end: dayData.end };
      }
    });

    const doctorWithSchedule = {
      name: doctor.name,
      specialty: doctor.specialtyCode,
      schedule: schedule
    };

    // Get day of week for the selected date - FIXED TIMEZONE ISSUE
    const selectedDate = new Date(date + 'T12:00:00'); // Add time to avoid timezone issues
    const dayOfWeek = DAY_NAMES[selectedDate.getDay()];

    // Check if doctor works on this day
    if (!doctorWithSchedule.schedule[dayOfWeek]) {
      return res.json({
        success: true,
        data: {
          availableSlots: [],
          message: `${doctorWithSchedule.name} is not available on ${dayOfWeek}s`
        }
      });
    }

    // Generate time slots (30-minute intervals)
    const { start, end } = doctorWithSchedule.schedule[dayOfWeek];
    const timeSlots = generateTimeSlots(start, end, 30);

    // Get existing appointments for this date and doctor
    const existingAppointments = await Appointment.find({
      appointmentDate: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      doctorName: doctorWithSchedule.name,
      status: { $nin: ['cancelled'] }
    });

    // Filter out booked slots
    const bookedTimes = existingAppointments.map(apt => apt.appointmentTime);
    const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));

    res.json({
      success: true,
      data: {
        slots: availableSlots,
        doctorInfo: {
          name: doctorWithSchedule.name,
          specialty: doctorWithSchedule.specialty,
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
    const settings = await getClinicSettings();
    const doctors = convertSettingsToDoctors(settings);

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

    // Check if slot is still available
    const existingAppointment = await Appointment.findOne({
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      doctorName,
      status: { $nin: ['cancelled'] }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is no longer available'
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

    // Get clinic settings to map doctor name to doctor type
    const settings = await getClinicSettings();
    let doctorInfo = null;
    
    // Check if doctor name matches OB-GYNE doctor
    if (doctorName === settings.obgyneDoctor.name) {
      doctorInfo = {
        doctorType: 'ob-gyne',
        defaultServiceType: 'PRENATAL_CHECKUP'
      };
    } 
    // Check if doctor name matches Pediatrician
    else if (doctorName === settings.pediatrician.name) {
      doctorInfo = {
        doctorType: 'pediatric', 
        defaultServiceType: 'WELL_CHILD_CHECKUP'
      };
    }
    
    if (!doctorInfo) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor selected. Please select a valid doctor from the list.'
      });
    }

    // Find or create patient record linked to PatientUser
    let patientRecord = await Patient.findOne({
      'contactInfo.email': patientUser.email
    });

    if (!patientRecord) {
      const patientData = {
        patientType: doctorInfo.doctorType,
        contactInfo: {
          email: patientUser.email,
          emergencyContact: patientUser.emergencyContact || {}
        },
        status: 'New'
      };

      if (doctorInfo.doctorType === 'pediatric') {
        patientData.pediatricRecord = {
          nameOfChildren: patientName,
          contactNumber: contactNumber,
        };
      } else { // ob-gyne
        patientData.obGyneRecord = {
          patientName: patientName,
          contactNumber: contactNumber,
        };
      }
      
      try {
        patientRecord = new Patient(patientData);
        await patientRecord.save();
        patientUser.patientRecord = patientRecord._id;
        await patientUser.save();
      } catch (err) {
        console.error('Book appointment error:', err);
        return res.status(500).json({ success: false, message: `Failed to create patient record: ${err.message}` });
      }
    }

    // Check if patient already has a pending/scheduled appointment
    const pendingAppointment = await Appointment.findOne({
      patientUserId: patientUser._id,
      status: { $in: ['scheduled', 'confirmed', 'cancellation_pending', 'reschedule_pending'] },
      appointmentDate: { $gte: new Date() } // Only future appointments
    });

    if (pendingAppointment) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending appointment. Please complete or cancel your current appointment before booking a new one.',
        data: {
          existingAppointment: {
            appointmentId: pendingAppointment.appointmentId,
            doctorName: pendingAppointment.doctorName,
            appointmentDate: pendingAppointment.appointmentDate,
            appointmentTime: pendingAppointment.appointmentTime,
            status: pendingAppointment.status
          }
        }
      });
    }

    // Create a new appointment
    const newAppointment = new Appointment({
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

    await newAppointment.save();

    // Return appointment details
    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      data: {
        appointment: {
          appointmentId: newAppointment.appointmentId,
          patientName: newAppointment.patientName,
          doctorName: newAppointment.doctorName,
          appointmentDate: newAppointment.appointmentDate,
          appointmentTime: newAppointment.appointmentTime,
          serviceType: newAppointment.serviceType,
          reasonForVisit: newAppointment.reasonForVisit,
          status: newAppointment.status,
          patientType: newAppointment.patientType,
          dependentInfo: newAppointment.dependentInfo
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get patient's appointments
router.get('/my-appointments', authenticatePatient, async (req, res) => {
  try {
    const appointments = await Appointment.find({
      patientUserId: req.patient.id
    })
    .select('appointmentId appointmentDate appointmentTime endTime doctorName doctorType serviceType status reasonForVisit cancellationRequest rescheduleRequest patientUserId bookingSource')
    .sort({ appointmentDate: -1, appointmentTime: -1 });

    // Ensure doctorName is set for all appointments (fallback based on doctorType)
    const settings = await getClinicSettings();
    const appointmentsWithDoctor = appointments.map(appointment => {
      if (!appointment.doctorName && appointment.doctorType) {
        // Use current clinic settings for fallback
        appointment.doctorName = appointment.doctorType === 'ob-gyne' 
          ? settings.obgyneDoctor.name 
          : settings.pediatrician.name;
      }
      return appointment;
    });

    res.json({
      success: true,
      data: { appointments: appointmentsWithDoctor }
    });

  } catch (error) {
    console.error('My appointments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving appointments'
    });
  }
});

// Request appointment cancellation (requires admin approval)
router.post('/request-cancellation/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    
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

    if (appointment.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a completed appointment'
      });
    }

    // Check if there's already a pending cancellation request
    if (appointment.cancellationRequest && appointment.cancellationRequest.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cancellation request is already pending admin approval'
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

    // Add cancellation request to appointment
    appointment.cancellationRequest = {
      status: 'pending',
      reason: reason || 'Patient requested cancellation',
      requestedAt: new Date(),
      requestedBy: req.patient.id
    };
    appointment.status = 'cancellation_pending';
    appointment.updatedAt = new Date();
    await appointment.save();

    res.json({
      success: true,
      message: 'Cancellation request submitted successfully. Please wait for admin approval.',
      data: { appointment }
    });

  } catch (error) {
    console.error('Request cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting appointment cancellation'
    });
  }
});

// Request appointment reschedule (requires admin approval)
router.post('/request-reschedule/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { reason, preferredDate, preferredTime } = req.body;
    
    console.log('Reschedule request debug:');
    console.log('appointmentId:', appointmentId);
    console.log('req.patient.id:', req.patient.id);
    console.log('req.body:', req.body);
    
    const appointment = await Appointment.findOne({
      appointmentId,
      patientUserId: req.patient.id
    });
    
    console.log('Found appointment:', appointment ? 'YES' : 'NO');

    if (!appointment) {
      console.log('No appointment found with query:', { appointmentId, patientUserId: req.patient.id });
      
      // Let's also check if appointment exists without patient filter
      const anyAppointment = await Appointment.findOne({ appointmentId });
      console.log('Appointment exists (without patient filter):', anyAppointment ? 'YES' : 'NO');
      if (anyAppointment) {
        console.log('Appointment patientUserId:', anyAppointment.patientUserId);
        console.log('Request patient id:', req.patient.id);
        console.log('Types - DB:', typeof anyAppointment.patientUserId, 'Request:', typeof req.patient.id);
      }
      
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

    // Check if there's already a pending reschedule request
    console.log('Appointment status:', appointment.status);
    console.log('Reschedule request:', appointment.rescheduleRequest);
    
    if (appointment.rescheduleRequest && appointment.rescheduleRequest.status === 'pending') {
      console.log('Blocking reschedule - already pending');
      return res.status(400).json({
        success: false,
        message: 'Reschedule request is already pending admin approval'
      });
    }

    // Check if appointment is in the future (allow rescheduling up to 2 hours before)
    const appointmentDateTime = new Date(`${appointment.appointmentDate.toISOString().split('T')[0]}T${convertTo24Hour(appointment.appointmentTime)}`);
    const now = new Date();
    const timeDifference = appointmentDateTime.getTime() - now.getTime();
    const hoursDifference = timeDifference / (1000 * 60 * 60);

    if (hoursDifference < 2) {
      return res.status(400).json({
        success: false,
        message: 'Appointments can only be rescheduled at least 2 hours in advance'
      });
    }

    // Add reschedule request to appointment
    appointment.rescheduleRequest = {
      status: 'pending',
      reason: reason || 'Patient requested reschedule',
      requestedAt: new Date(),
      requestedBy: req.patient.id,
      preferredDate: preferredDate ? new Date(preferredDate) : null,
      preferredTime: preferredTime || null
    };
    appointment.status = 'reschedule_pending';
    appointment.updatedAt = new Date();
    await appointment.save();

    res.json({
      success: true,
      message: 'Reschedule request submitted successfully. Please wait for admin approval.',
      data: { appointment }
    });

  } catch (error) {
    console.error('Request reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error requesting appointment reschedule'
    });
  }
});

// Accept cancellation request (when admin cancels patient's appointment)
router.post('/accept-cancellation/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Try to find by MongoDB _id first, then by appointmentId string
    // Convert string _id to ObjectId if it's a valid ObjectId string
    let query = {
      patientUserId: req.patient.id
    };
    
    // Check if appointmentId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(appointmentId) && appointmentId.length === 24) {
      query.$or = [
        { _id: new mongoose.Types.ObjectId(appointmentId) },
        { appointmentId: appointmentId }
      ];
    } else {
      query.appointmentId = appointmentId;
    }
    
    const appointment = await Appointment.findOne(query);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== 'cancellation_pending') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is not pending cancellation approval'
      });
    }

    // Check if this is a staff-initiated cancellation (no requestedBy field)
    if (appointment.cancellationRequest && appointment.cancellationRequest.requestedBy) {
      return res.status(400).json({
        success: false,
        message: 'This is a patient-initiated cancellation request. Please wait for admin approval.'
      });
    }

    // Accept the cancellation
    appointment.status = 'cancelled';
    if (appointment.cancellationRequest) {
      appointment.cancellationRequest.status = 'approved';
      appointment.cancellationRequest.reviewedAt = new Date();
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Cancellation accepted successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Accept cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting cancellation'
    });
  }
});

// Accept reschedule request (when admin reschedules patient's appointment)
router.post('/accept-reschedule/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Try to find by MongoDB _id first, then by appointmentId string
    // Convert string _id to ObjectId if it's a valid ObjectId string
    let query = {
      patientUserId: req.patient.id
    };
    
    // Check if appointmentId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(appointmentId) && appointmentId.length === 24) {
      query.$or = [
        { _id: new mongoose.Types.ObjectId(appointmentId) },
        { appointmentId: appointmentId }
      ];
    } else {
      query.appointmentId = appointmentId;
    }
    
    const appointment = await Appointment.findOne(query);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== 'reschedule_pending') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is not pending reschedule approval'
      });
    }

    // Check if this is a staff-initiated reschedule (has rescheduleRequest but no requestedBy)
    if (appointment.rescheduleRequest && appointment.rescheduleRequest.requestedBy) {
      return res.status(400).json({
        success: false,
        message: 'This is a patient-initiated reschedule request. Please wait for admin approval.'
      });
    }

    // Accept the reschedule - change status to confirmed or scheduled
    appointment.status = 'confirmed';
    if (appointment.rescheduleRequest) {
      appointment.rescheduleRequest.status = 'approved';
      appointment.rescheduleRequest.reviewedAt = new Date();
    }

    await appointment.save();

    res.json({
      success: true,
      message: 'Reschedule accepted successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Accept reschedule error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error accepting reschedule',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Cancel appointment when patient rejects admin reschedule
router.post('/cancel-reschedule/:appointmentId', authenticatePatient, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    
    // Try to find by MongoDB _id first, then by appointmentId string
    let query = {
      patientUserId: req.patient.id
    };
    
    // Check if appointmentId is a valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(appointmentId) && appointmentId.length === 24) {
      query.$or = [
        { _id: new mongoose.Types.ObjectId(appointmentId) },
        { appointmentId: appointmentId }
      ];
    } else {
      query.appointmentId = appointmentId;
    }
    
    const appointment = await Appointment.findOne(query);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    if (appointment.status !== 'reschedule_pending') {
      return res.status(400).json({
        success: false,
        message: 'Appointment is not pending reschedule approval'
      });
    }

    // Check if this is a staff-initiated reschedule (has rescheduleRequest but no requestedBy)
    if (appointment.rescheduleRequest && appointment.rescheduleRequest.requestedBy) {
      return res.status(400).json({
        success: false,
        message: 'This is a patient-initiated reschedule request. Please wait for admin approval.'
      });
    }

    // Cancel the appointment - patient rejected the reschedule
    appointment.status = 'cancelled';
    if (appointment.rescheduleRequest) {
      appointment.rescheduleRequest.status = 'rejected';
      appointment.rescheduleRequest.reviewedAt = new Date();
    }
    appointment.cancellationReason = 'Patient rejected reschedule and cancelled appointment';

    await appointment.save();

    res.json({
      success: true,
      message: 'Appointment cancelled successfully',
      data: { appointment }
    });

  } catch (error) {
    console.error('Cancel reschedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling appointment',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Legacy cancel appointment endpoint (kept for backward compatibility, but now requires admin approval)
router.put('/cancel-appointment/:appointmentId', authenticatePatient, async (req, res) => {
  // Redirect to the new request cancellation endpoint
  req.url = `/request-cancellation/${req.params.appointmentId}`;
  req.method = 'POST';
  return router.handle(req, res);
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