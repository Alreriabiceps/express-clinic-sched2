import express from 'express';
import { query, validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import { authenticateToken, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// Doctor schedules configuration
const DOCTOR_SCHEDULES = {
  'Dr. Maria Sarah L. Manaloto': {
    specialty: 'ob-gyne',
    schedule: {
      1: { start: '08:00', end: '12:00', slots: 30 }, // Monday 8AM-12PM, 30min slots
      3: { start: '09:00', end: '14:00', slots: 30 }, // Wednesday 9AM-2PM
      5: { start: '13:00', end: '17:00', slots: 30 }  // Friday 1PM-5PM
    }
  },
  'Dr. Shara Laine S. Vino': {
    specialty: 'pediatric',
    schedule: {
      1: { start: '13:00', end: '17:00', slots: 30 }, // Monday 1PM-5PM
      2: { start: '13:00', end: '17:00', slots: 30 }, // Tuesday 1PM-5PM
      4: { start: '08:00', end: '12:00', slots: 30 }  // Thursday 8AM-12PM
    }
  }
};

// Helper function to generate time slots
function generateTimeSlots(startTime, endTime, slotDuration) {
  const slots = [];
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  for (let minutes = startMinutes; minutes < endMinutes; minutes += slotDuration) {
    const hour = Math.floor(minutes / 60);
    const min = minutes % 60;
    
    // Convert to 12-hour format
    let displayHour = hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    
    if (hour > 12) displayHour = hour - 12;
    if (hour === 0) displayHour = 12;
    
    const timeString = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
    slots.push(timeString);
  }
  
  return slots;
}

// Get doctor schedules
router.get('/schedules', [authenticateToken, requireStaff], async (req, res) => {
  try {
    const schedules = {};
    
    Object.entries(DOCTOR_SCHEDULES).forEach(([doctorName, config]) => {
      schedules[doctorName] = {
        specialty: config.specialty,
        weeklySchedule: {}
      };
      
      Object.entries(config.schedule).forEach(([dayOfWeek, schedule]) => {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[parseInt(dayOfWeek)];
        
        schedules[doctorName].weeklySchedule[dayName] = {
          dayOfWeek: parseInt(dayOfWeek),
          startTime: schedule.start,
          endTime: schedule.end,
          slotDuration: schedule.slots,
          available: true
        };
      });
    });
    
    res.json({
      success: true,
      data: { schedules }
    });
    
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving schedules'
    });
  }
});

// Get available slots for a specific doctor and date
router.get('/slots', [
  authenticateToken,
  requireStaff,
  query('doctorName').notEmpty().withMessage('Doctor name is required'),
  query('date').isISO8601().withMessage('Valid date is required')
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

    const { doctorName, date } = req.query;
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Check if doctor exists
    if (!DOCTOR_SCHEDULES[doctorName]) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    const doctorConfig = DOCTOR_SCHEDULES[doctorName];
    const daySchedule = doctorConfig.schedule[dayOfWeek];

    // Check if doctor works on this day
    if (!daySchedule) {
      return res.json({
        success: true,
        data: {
          doctorName,
          date,
          available: false,
          reason: 'Doctor not available on this day',
          slots: []
        }
      });
    }

    // Generate all possible time slots
    const allSlots = generateTimeSlots(daySchedule.start, daySchedule.end, daySchedule.slots);

    // Get existing appointments for this doctor and date
    const startOfDay = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate());
    const endOfDay = new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate() + 1);

    const existingAppointments = await Appointment.find({
      doctorName,
      appointmentDate: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      status: { $in: ['scheduled', 'confirmed'] }
    });

    const bookedSlots = existingAppointments.map(apt => apt.appointmentTime);

    // Filter available slots
    const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

    res.json({
      success: true,
      data: {
        doctorName,
        date,
        specialty: doctorConfig.specialty,
        available: true,
        totalSlots: allSlots.length,
        availableSlots: availableSlots.length,
        bookedSlots: bookedSlots.length,
        slots: {
          all: allSlots,
          available: availableSlots,
          booked: bookedSlots
        }
      }
    });

  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving available slots'
    });
  }
});

// Get availability summary for multiple days
router.get('/summary', [
  authenticateToken,
  requireStaff,
  query('startDate').isISO8601().withMessage('Valid start date is required'),
  query('endDate').optional().isISO8601().withMessage('Valid end date required'),
  query('doctorName').optional().notEmpty().withMessage('Doctor name cannot be empty')
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

    const startDate = new Date(req.query.startDate);
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date(startDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // Default to 7 days
    const doctorName = req.query.doctorName;

    const availabilitySummary = {};

    // Get doctors to check
    const doctorsToCheck = doctorName ? [doctorName] : Object.keys(DOCTOR_SCHEDULES);

    for (const doctor of doctorsToCheck) {
      availabilitySummary[doctor] = {};
      const doctorConfig = DOCTOR_SCHEDULES[doctor];

      // Check each day in the date range
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        const dayOfWeek = currentDate.getDay();
        const daySchedule = doctorConfig.schedule[dayOfWeek];

        if (daySchedule) {
          // Generate slots for this day
          const allSlots = generateTimeSlots(daySchedule.start, daySchedule.end, daySchedule.slots);

          // Get existing appointments
          const startOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
          const endOfDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1);

          const existingAppointments = await Appointment.find({
            doctorName: doctor,
            appointmentDate: {
              $gte: startOfDay,
              $lt: endOfDay
            },
            status: { $in: ['scheduled', 'confirmed'] }
          });

          const bookedCount = existingAppointments.length;
          const availableCount = allSlots.length - bookedCount;

          availabilitySummary[doctor][dateString] = {
            workingDay: true,
            totalSlots: allSlots.length,
            availableSlots: availableCount,
            bookedSlots: bookedCount,
            availability: ((availableCount / allSlots.length) * 100).toFixed(1) + '%'
          };
        } else {
          availabilitySummary[doctor][dateString] = {
            workingDay: false,
            totalSlots: 0,
            availableSlots: 0,
            bookedSlots: 0,
            availability: 'N/A'
          };
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    res.json({
      success: true,
      data: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        doctors: doctorName ? [doctorName] : doctorsToCheck,
        availabilitySummary
      }
    });

  } catch (error) {
    console.error('Get availability summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving availability summary'
    });
  }
});

// Check specific slot availability
router.get('/check-slot', [
  authenticateToken,
  requireStaff,
  query('doctorName').notEmpty().withMessage('Doctor name is required'),
  query('date').isISO8601().withMessage('Valid date is required'),
  query('time').notEmpty().withMessage('Time is required')
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

    const { doctorName, date, time } = req.query;
    const requestedDate = new Date(date);

    // Check if appointment already exists
    const existingAppointment = await Appointment.findOne({
      doctorName,
      appointmentDate: {
        $gte: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate()),
        $lt: new Date(requestedDate.getFullYear(), requestedDate.getMonth(), requestedDate.getDate() + 1)
      },
      appointmentTime: time,
      status: { $in: ['scheduled', 'confirmed'] }
    });

    const isAvailable = !existingAppointment;

    res.json({
      success: true,
      data: {
        doctorName,
        date,
        time,
        available: isAvailable,
        reason: existingAppointment ? 'Time slot already booked' : 'Available'
      }
    });

  } catch (error) {
    console.error('Check slot availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error checking slot availability'
    });
  }
});

export default router; 