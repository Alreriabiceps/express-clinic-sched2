import express from 'express';
import { body, validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import PatientUser from '../models/PatientUser.js';

const router = express.Router();

// Get available time slots for a specific date and doctor
router.get('/available-slots', async (req, res) => {
  try {
    const { date, doctorName, serviceType } = req.query;
    
    if (!date || !doctorName) {
      return res.status(400).json({
        success: false,
        message: 'Date and doctor name are required'
      });
    }

    // Define doctor schedules
    const doctorSchedules = {
      'Dr. Maria Sarah L. Manaloto': {
        specialty: 'ob-gyne',
        schedule: {
          'Monday': { start: '08:00', end: '12:00' },
          'Wednesday': { start: '09:00', end: '14:00' },
          'Friday': { start: '13:00', end: '17:00' }
        }
      },
      'Dr. Shara Laine S. Vino': {
        specialty: 'pediatric',
        schedule: {
          'Monday': { start: '13:00', end: '17:00' },
          'Tuesday': { start: '13:00', end: '17:00' },
          'Thursday': { start: '08:00', end: '12:00' }
        }
      }
    };

    const doctor = doctorSchedules[doctorName];
    if (!doctor) {
      return res.status(400).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Get day of week for the selected date
    const selectedDate = new Date(date);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[selectedDate.getDay()];

    // Check if doctor works on this day
    if (!doctor.schedule[dayOfWeek]) {
      return res.json({
        success: true,
        data: {
          availableSlots: [],
          message: `${doctorName} is not available on ${dayOfWeek}s`
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
      doctorName,
      status: { $nin: ['cancelled'] }
    });

    // Filter out booked slots
    const bookedTimes = existingAppointments.map(apt => apt.appointmentTime);
    const availableSlots = timeSlots.filter(slot => !bookedTimes.includes(slot));

    res.json({
      success: true,
      data: {
        availableSlots,
        doctorInfo: {
          name: doctorName,
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
router.post('/book-appointment', [
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

    // Get patient user info (you'll need to implement auth middleware)
    const patientUserId = req.user?.id || req.body.patientUserId; // For testing
    const patientUser = await PatientUser.findById(patientUserId);
    
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

    // Create appointment
    const appointment = new Appointment({
      appointmentId,
      patientName,
      contactNumber,
      doctorName,
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      serviceType,
      reasonForVisit: reasonForVisit || 'General consultation',
      status: 'scheduled',
      patientUserId: patientUser._id,
      patientType,
      dependentInfo: patientType === 'dependent' ? dependentInfo : undefined
    });

    await appointment.save();

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
    res.status(500).json({
      success: false,
      message: 'Error booking appointment'
    });
  }
});

// Get patient's appointments
router.get('/my-appointments', async (req, res) => {
  try {
    const patientUserId = req.user?.id || req.query.patientUserId; // For testing
    
    if (!patientUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const appointments = await Appointment.find({
      patientUserId
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
router.put('/cancel-appointment/:appointmentId', async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const patientUserId = req.user?.id || req.body.patientUserId; // For testing
    
    const appointment = await Appointment.findOne({
      appointmentId,
      patientUserId
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