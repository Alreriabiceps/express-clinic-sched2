import express from 'express';
import { query, validationResult } from 'express-validator';
import Appointment from '../models/Appointment.js';
import Patient from '../models/Patient.js';
import { authenticateToken, requireStaff } from '../middleware/auth.js';

const router = express.Router();

// Get daily report
router.get('/daily', [
  authenticateToken,
  requireStaff,
  query('date').optional().isISO8601().withMessage('Valid date required'),
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

    const date = req.query.date ? new Date(req.query.date) : new Date();
    const doctorName = req.query.doctorName;

    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    // Build filter
    const filter = {
      appointmentDate: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    };

    if (doctorName) {
      filter.doctorName = doctorName;
    }

    // Get appointments for the day
    const appointments = await Appointment.find(filter)
      .populate('patient', 'patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName')
      .sort({ appointmentTime: 1 });

    // Calculate statistics
    const stats = {
      total: appointments.length,
      scheduled: appointments.filter(apt => apt.status === 'scheduled').length,
      confirmed: appointments.filter(apt => apt.status === 'confirmed').length,
      completed: appointments.filter(apt => apt.status === 'completed').length,
      cancelled: appointments.filter(apt => apt.status === 'cancelled').length,
      noShow: appointments.filter(apt => apt.status === 'no-show').length,
      pediatric: appointments.filter(apt => apt.doctorType === 'pediatric').length,
      obGyne: appointments.filter(apt => apt.doctorType === 'ob-gyne').length
    };

    // Group by service type
    const serviceStats = appointments.reduce((acc, apt) => {
      acc[apt.serviceType] = (acc[apt.serviceType] || 0) + 1;
      return acc;
    }, {});

    // Group by doctor
    const doctorStats = appointments.reduce((acc, apt) => {
      acc[apt.doctorName] = (acc[apt.doctorName] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        date: date.toISOString().split('T')[0],
        doctor: doctorName || 'All Doctors',
        appointments,
        statistics: {
          ...stats,
          serviceBreakdown: serviceStats,
          doctorBreakdown: doctorStats
        }
      }
    });

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating daily report'
    });
  }
});

// Get weekly report
router.get('/weekly', [
  authenticateToken,
  requireStaff,
  query('startDate').optional().isISO8601().withMessage('Valid start date required'),
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

    const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
    const doctorName = req.query.doctorName;

    // Calculate week boundaries
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Build filter
    const filter = {
      appointmentDate: {
        $gte: weekStart,
        $lt: weekEnd
      }
    };

    if (doctorName) {
      filter.doctorName = doctorName;
    }

    // Get appointments for the week
    const appointments = await Appointment.find(filter)
      .populate('patient', 'patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName')
      .sort({ appointmentDate: 1, appointmentTime: 1 });

    // Group by day
    const dailyBreakdown = {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    days.forEach(day => {
      dailyBreakdown[day] = {
        total: 0,
        completed: 0,
        cancelled: 0,
        appointments: []
      };
    });

    appointments.forEach(apt => {
      const dayName = days[apt.appointmentDate.getDay()];
      dailyBreakdown[dayName].total++;
      dailyBreakdown[dayName].appointments.push(apt);
      
      if (apt.status === 'completed') {
        dailyBreakdown[dayName].completed++;
      } else if (apt.status === 'cancelled') {
        dailyBreakdown[dayName].cancelled++;
      }
    });

    // Calculate overall statistics
    const stats = {
      total: appointments.length,
      scheduled: appointments.filter(apt => apt.status === 'scheduled').length,
      confirmed: appointments.filter(apt => apt.status === 'confirmed').length,
      completed: appointments.filter(apt => apt.status === 'completed').length,
      cancelled: appointments.filter(apt => apt.status === 'cancelled').length,
      noShow: appointments.filter(apt => apt.status === 'no-show').length,
      pediatric: appointments.filter(apt => apt.doctorType === 'pediatric').length,
      obGyne: appointments.filter(apt => apt.doctorType === 'ob-gyne').length
    };

    res.json({
      success: true,
      data: {
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        doctor: doctorName || 'All Doctors',
        dailyBreakdown,
        statistics: stats,
        totalAppointments: appointments.length
      }
    });

  } catch (error) {
    console.error('Weekly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating weekly report'
    });
  }
});

// Get dashboard analytics
router.get('/dashboard', [authenticateToken, requireStaff], async (req, res) => {
  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get today's appointments
    const todayAppointments = await Appointment.find({
      appointmentDate: {
        $gte: startOfToday,
        $lt: endOfToday
      }
    });

    // Get this week's appointments
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekAppointments = await Appointment.find({
      appointmentDate: {
        $gte: weekStart,
        $lt: weekEnd
      }
    });

    // Get this month's appointments
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const monthAppointments = await Appointment.find({
      appointmentDate: {
        $gte: monthStart,
        $lt: monthEnd
      }
    });

    // Patient statistics
    const totalPatients = await Patient.countDocuments({ isActive: true });
    const pediatricPatients = await Patient.countDocuments({ 
      patientType: 'pediatric', 
      isActive: true 
    });
    const obGynePatients = await Patient.countDocuments({ 
      patientType: 'ob-gyne', 
      isActive: true 
    });

    // Recent appointments (next 5 upcoming)
    const upcomingAppointments = await Appointment.find({
      appointmentDate: { $gte: today },
      status: { $in: ['scheduled', 'confirmed'] }
    })
    .populate('patient', 'patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName')
    .sort({ appointmentDate: 1, appointmentTime: 1 })
    .limit(5);

    res.json({
      success: true,
      data: {
        today: {
          total: todayAppointments.length,
          completed: todayAppointments.filter(apt => apt.status === 'completed').length,
          pending: todayAppointments.filter(apt => ['scheduled', 'confirmed'].includes(apt.status)).length,
          cancelled: todayAppointments.filter(apt => apt.status === 'cancelled').length
        },
        thisWeek: {
          total: weekAppointments.length,
          completed: weekAppointments.filter(apt => apt.status === 'completed').length,
          pending: weekAppointments.filter(apt => ['scheduled', 'confirmed'].includes(apt.status)).length
        },
        thisMonth: {
          total: monthAppointments.length,
          completed: monthAppointments.filter(apt => apt.status === 'completed').length,
          pending: monthAppointments.filter(apt => ['scheduled', 'confirmed'].includes(apt.status)).length
        },
        patients: {
          total: totalPatients,
          pediatric: pediatricPatients,
          obGyne: obGynePatients
        },
        upcomingAppointments
      }
    });

  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating dashboard analytics'
    });
  }
});

// Get monthly summary
router.get('/monthly', [
  authenticateToken,
  requireStaff,
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Valid month required (1-12)'),
  query('year').optional().isInt({ min: 2020 }).withMessage('Valid year required')
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

    const today = new Date();
    const month = parseInt(req.query.month) || (today.getMonth() + 1);
    const year = parseInt(req.query.year) || today.getFullYear();

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // Get all appointments for the month
    const appointments = await Appointment.find({
      appointmentDate: {
        $gte: monthStart,
        $lt: monthEnd
      }
    }).populate('patient', 'patientId patientType');

    // Group by day of month
    const dailyStats = {};
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month - 1, day);
      if (date.getMonth() === month - 1) {
        dailyStats[day] = {
          total: 0,
          completed: 0,
          cancelled: 0,
          pediatric: 0,
          obGyne: 0
        };
      }
    }

    appointments.forEach(apt => {
      const day = apt.appointmentDate.getDate();
      if (dailyStats[day]) {
        dailyStats[day].total++;
        
        if (apt.status === 'completed') {
          dailyStats[day].completed++;
        } else if (apt.status === 'cancelled') {
          dailyStats[day].cancelled++;
        }

        if (apt.doctorType === 'pediatric') {
          dailyStats[day].pediatric++;
        } else if (apt.doctorType === 'ob-gyne') {
          dailyStats[day].obGyne++;
        }
      }
    });

    // Calculate monthly totals
    const monthlyTotals = {
      total: appointments.length,
      completed: appointments.filter(apt => apt.status === 'completed').length,
      cancelled: appointments.filter(apt => apt.status === 'cancelled').length,
      pediatric: appointments.filter(apt => apt.doctorType === 'pediatric').length,
      obGyne: appointments.filter(apt => apt.doctorType === 'ob-gyne').length
    };

    res.json({
      success: true,
      data: {
        month,
        year,
        monthName: monthStart.toLocaleString('default', { month: 'long' }),
        dailyStats,
        monthlyTotals
      }
    });

  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating monthly report'
    });
  }
});

export default router; 