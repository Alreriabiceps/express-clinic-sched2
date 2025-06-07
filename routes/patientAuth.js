import express from 'express';
import { body, validationResult } from 'express-validator';
import PatientUser from '../models/PatientUser.js';
import Patient from '../models/Patient.js';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken
} from '../middleware/auth.js';

const router = express.Router();

// Patient registration endpoint
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, phoneNumber, dateOfBirth, address, emergencyContact } = req.body;

    // Check if patient already exists
    const existingPatient = await PatientUser.findOne({ email });
    if (existingPatient) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Create new patient user
    const patientUser = new PatientUser({
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth,
      address,
      emergencyContact
    });

    await patientUser.save();

    // Generate tokens
    const token = generateToken(patientUser);
    const refreshToken = generateRefreshToken(patientUser);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: patientUser._id,
          email: patientUser.email,
          firstName: patientUser.firstName,
          lastName: patientUser.lastName,
          fullName: patientUser.fullName,
          phoneNumber: patientUser.phoneNumber,
          dateOfBirth: patientUser.dateOfBirth,
          age: patientUser.age,
          address: patientUser.address,
          emergencyContact: patientUser.emergencyContact,
          isVerified: patientUser.isVerified
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
});

// Patient login endpoint
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find patient by email
    const patientUser = await PatientUser.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    }).populate('patientRecord');

    if (!patientUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isValidPassword = await patientUser.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    patientUser.lastLogin = new Date();
    await patientUser.save();

    // Generate tokens
    const token = generateToken(patientUser);
    const refreshToken = generateRefreshToken(patientUser);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: patientUser._id,
          email: patientUser.email,
          firstName: patientUser.firstName,
          lastName: patientUser.lastName,
          fullName: patientUser.fullName,
          phoneNumber: patientUser.phoneNumber,
          dateOfBirth: patientUser.dateOfBirth,
          age: patientUser.age,
          address: patientUser.address,
          emergencyContact: patientUser.emergencyContact,
          isVerified: patientUser.isVerified,
          patientRecord: patientUser.patientRecord,
          lastLogin: patientUser.lastLogin
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// Patient profile endpoint
router.get('/profile', async (req, res) => {
  try {
    // This will be protected by patient auth middleware
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // For now, we'll implement a simple token verification
    // In production, you'd want proper JWT middleware
    const patientUser = await PatientUser.findById(req.user?.id || req.body.userId)
      .populate('patientRecord');

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: patientUser
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving profile'
    });
  }
});

// Update patient profile
router.put('/profile', [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phoneNumber').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail()
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

    const updates = req.body;
    delete updates.password; // Don't allow password updates through this endpoint

    const patientUser = await PatientUser.findByIdAndUpdate(
      req.user?.id || req.body.userId,
      updates,
      { new: true, runValidators: true }
    );

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: patientUser
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating profile'
    });
  }
});

// Change password
router.put('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
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

    const { currentPassword, newPassword } = req.body;
    const patientUser = await PatientUser.findById(req.user?.id || req.body.userId);

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Verify current password
    const isValidPassword = await patientUser.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    patientUser.password = newPassword;
    await patientUser.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error changing password'
    });
  }
});

export default router; 