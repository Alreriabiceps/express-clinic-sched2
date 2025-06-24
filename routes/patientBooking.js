import express from 'express';
import { body, validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import PatientUser from '../models/PatientUser.js';
import { authenticatePatient } from '../middleware/patientAuth.js';

const router = express.Router();

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

    // Define doctor schedules with IDs
    const doctorSchedules = {
      'doc_1': {
        name: 'Dr. Maria Sarah L. Manaloto',
        specialty: 'ob-gyne',
        schedule: {
          'Monday': { start: '08:00', end: '12:00' },
          'Wednesday': { start: '09:00', end: '14:00' },
          'Friday': { start: '13:00', end: '17:00' }
        }
      },
      'doc_2': {
        name: 'Dr. Shara Laine S. Vino',
        specialty: 'pediatric',
        schedule: {
          'Monday': { start: '13:00', end: '17:00' },
          'Tuesday': { start: '13:00', end: '17:00' },
          'Thursday': { start: '08:00', end: '12:00' }
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
      }
      
      // Move to next day
      checkDate.setDate(checkDate.getDate() + 1);
    }



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
    

    
    if (!date || !doctorId) {
      return res.status(400).json({
        success: false,
        message: 'Date and doctor ID are required'
      });
    }

    // Define doctor schedules with IDs
    const doctorSchedules = {
      'doc_1': {
        name: 'Dr. Maria Sarah L. Manaloto',
        specialty: 'ob-gyne',
        schedule: {
          'Monday': { start: '08:00', end: '12:00' },
          'Wednesday': { start: '09:00', end: '14:00' },
          'Friday': { start: '13:00', end: '17:00' }
        }
      },
      'doc_2': {
        name: 'Dr. Shara Laine S. Vino',
        specialty: 'pediatric',
        schedule: {
          'Monday': { start: '13:00', end: '17:00' },
          'Tuesday': { start: '13:00', end: '17:00' },
          'Thursday': { start: '08:00', end: '12:00' }
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

    // Check if doctor works on this day
    if (!doctor.schedule[dayOfWeek]) {
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
    const timeSlots = generateTimeSlots(start, end, 30);

    // Get existing appointments for this date and doctor
    const existingAppointments = await Appointment.find({
      appointmentDate: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      doctorName: doctor.name,
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
    const doctors = [
      {
        _id: 'doc_1',
        name: 'Dr. Maria Sarah L. Manaloto',
        specialty: 'OB-GYNE',
        specialtyCode: 'ob-gyne',
        description: 'Obstetrics and Gynecology specialist',
        schedule: {
          'Monday': '8:00 AM - 12:00 PM',
          'Wednesday': '9:00 AM - 2:00 PM', 
          'Friday': '1:00 PM - 5:00 PM'
        },
        workingDays: ['Monday', 'Wednesday', 'Friday']
      },
      {
        _id: 'doc_2',
        name: 'Dr. Shara Laine S. Vino',
        specialty: 'Pediatric',
        specialtyCode: 'pediatric',
        description: 'Pediatrics specialist for children and infants',
        schedule: {
          'Monday': '1:00 PM - 5:00 PM',
          'Tuesday': '1:00 PM - 5:00 PM',
          'Thursday': '8:00 AM - 12:00 PM'
        },
        workingDays: ['Monday', 'Tuesday', 'Thursday']
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

    // Map specialty to doctorType and serviceType
    const doctorSchedules = {
      'Dr. Maria Sarah L. Manaloto': {
        doctorType: 'ob-gyne',
        defaultServiceType: 'PRENATAL_CHECKUP'
      },
      'Dr. Shara Laine S. Vino': {
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