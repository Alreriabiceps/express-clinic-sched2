import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { authenticatePatient } from '../middleware/patientAuth.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import PatientUser from '../models/PatientUser.js';

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

// In-memory store for clinic settings (can be replaced with database later)
let clinicSettings = {
  clinicName: 'VM Mother and Child Clinic',
  obgyneDoctor: {
    name: 'Dr. Maria Sarah L. Manaloto',
    hours: {
      monday: { enabled: true, start: '08:00', end: '12:00' },
      tuesday: { enabled: false, start: '', end: '' },
      wednesday: { enabled: true, start: '09:00', end: '14:00' },
      thursday: { enabled: false, start: '', end: '' },
      friday: { enabled: true, start: '13:00', end: '17:00' },
      saturday: { enabled: false, start: '', end: '' },
      sunday: { enabled: false, start: '', end: '' }
    }
  },
  pediatrician: {
    name: 'Dr. Shara Laine S. Vino',
    hours: {
      monday: { enabled: true, start: '13:00', end: '17:00' },
      tuesday: { enabled: true, start: '13:00', end: '17:00' },
      wednesday: { enabled: false, start: '', end: '' },
      thursday: { enabled: true, start: '08:00', end: '12:00' },
      friday: { enabled: false, start: '', end: '' },
      saturday: { enabled: false, start: '', end: '' },
      sunday: { enabled: false, start: '', end: '' }
    }
  }
};

// Get clinic settings (accessible to both patients and staff)
router.get('/clinic', authenticateAny, async (req, res) => {
  try {
    res.json({
      success: true,
      data: clinicSettings
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

    if (clinicName) {
      clinicSettings.clinicName = clinicName;
    }

    if (obgyneDoctor) {
      clinicSettings.obgyneDoctor = {
        ...clinicSettings.obgyneDoctor,
        ...obgyneDoctor
      };
    }

    if (pediatrician) {
      clinicSettings.pediatrician = {
        ...clinicSettings.pediatrician,
        ...pediatrician
      };
    }

    res.json({
      success: true,
      message: 'Clinic settings updated successfully',
      data: clinicSettings
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
