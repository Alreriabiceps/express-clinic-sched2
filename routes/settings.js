import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { authenticatePatient } from '../middleware/patientAuth.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PatientUser from '../models/PatientUser.js';
import Settings from '../models/Settings.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware that accepts both patient and staff/admin tokens
const authenticateAny = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token required' 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Try to find as staff/admin user first
    const user = await User.findById(decoded.id).select('-password');
    if (user && user.isActive) {
      req.user = user;
      req.authType = 'staff';
      return next();
    }
    
    // Try to find as patient user
    const patient = await PatientUser.findById(decoded.id).select('-password');
    if (patient && patient.isActive) {
      req.patient = {
        ...patient.toObject(),
        id: patient._id.toString()
      };
      req.authType = 'patient';
      return next();
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token or account not active' 
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Get clinic settings (accessible to both patients and staff)
router.get('/clinic', authenticateAny, async (req, res) => {
  try {
    // Get settings from database
    const settings = await Settings.getSettings();
    
    res.json({
      success: true,
      data: {
        clinicName: settings.clinicName,
        obgyneDoctor: settings.obgyneDoctor,
        pediatrician: settings.pediatrician
      }
    });
  } catch (error) {
    console.error('Error fetching clinic settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching clinic settings',
      error: error.message
    });
  }
});

// Update clinic settings (admin only)
router.put('/clinic', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { clinicName, obgyneDoctor, pediatrician } = req.body;

    // Get current settings from database
    let settings = await Settings.findOne();
    
    if (!settings) {
      // Create new settings if none exist
      settings = new Settings({
        clinicName: clinicName || 'VM Mother and Child Clinic',
        obgyneDoctor: obgyneDoctor || {
          name: 'Dr. Maria Sarah L. Manaloto',
          hours: {
            monday: { start: '08:00', end: '12:00', enabled: true },
            tuesday: { start: '', end: '', enabled: false },
            wednesday: { start: '09:00', end: '14:00', enabled: true },
            thursday: { start: '', end: '', enabled: false },
            friday: { start: '13:00', end: '17:00', enabled: true },
            saturday: { start: '', end: '', enabled: false },
            sunday: { start: '', end: '', enabled: false }
          }
        },
        pediatrician: pediatrician || {
          name: 'Dr. Shara Laine S. Vino',
          hours: {
            monday: { start: '13:00', end: '17:00', enabled: true },
            tuesday: { start: '13:00', end: '17:00', enabled: true },
            wednesday: { start: '', end: '', enabled: false },
            thursday: { start: '08:00', end: '12:00', enabled: true },
            friday: { start: '', end: '', enabled: false },
            saturday: { start: '', end: '', enabled: false },
            sunday: { start: '', end: '', enabled: false }
          }
        }
      });
    } else {
      // Update existing settings
      if (clinicName) {
        settings.clinicName = clinicName;
      }

      if (obgyneDoctor) {
        if (obgyneDoctor.name) {
          settings.obgyneDoctor.name = obgyneDoctor.name;
        }
        if (obgyneDoctor.hours) {
          // Deep merge hours to preserve all day settings
          Object.keys(obgyneDoctor.hours).forEach(day => {
            if (obgyneDoctor.hours[day]) {
              settings.obgyneDoctor.hours[day] = {
                ...settings.obgyneDoctor.hours[day],
                ...obgyneDoctor.hours[day]
              };
            }
          });
        }
      }

      if (pediatrician) {
        if (pediatrician.name) {
          settings.pediatrician.name = pediatrician.name;
        }
        if (pediatrician.hours) {
          // Deep merge hours to preserve all day settings
          Object.keys(pediatrician.hours).forEach(day => {
            if (pediatrician.hours[day]) {
              settings.pediatrician.hours[day] = {
                ...settings.pediatrician.hours[day],
                ...pediatrician.hours[day]
              };
            }
          });
        }
      }
    }

    await settings.save();

    res.json({
      success: true,
      message: 'Clinic settings updated successfully',
      data: {
        clinicName: settings.clinicName,
        obgyneDoctor: settings.obgyneDoctor,
        pediatrician: settings.pediatrician
      }
    });
  } catch (error) {
    console.error('Error updating clinic settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating clinic settings',
      error: error.message
    });
  }
});

export default router;
