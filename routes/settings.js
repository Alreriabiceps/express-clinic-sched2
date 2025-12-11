import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

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

// Get clinic settings
router.get('/clinic', authenticateToken, async (req, res) => {
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

// Update clinic settings
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

