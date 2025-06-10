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
    
    console.log('Available dates request for doctorId:', doctorId);
    
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

    // Get existing appointments for this date and doctor
    const existingAppointments = await Appointment.find({
      appointmentDate: {
        $gte: new Date(date + 'T00:00:00.000Z'),
        $lt: new Date(date + 'T23:59:59.999Z')
      },
      doctorName: doctor.name,
      status: { $nin: ['cancelled'] }
    });

    console.log('Existing appointments:', existingAppointments.length);

    // Filter out booked slots
    const bookedTimes = existingAppointments.map(apt => apt.appointmentTime);
    const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));

    console.log('Available slots:', availableSlots);

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