import express from 'express';
import { body, validationResult } from 'express-validator';
import PatientUser from '../models/PatientUser.js';
import Patient from '../models/Patient.js';
import {
  authenticatePatient,
  generatePatientToken,
  generatePatientRefreshToken,
  verifyPatientRefreshToken
} from '../middleware/patientAuth.js';

const router = express.Router();

// Patient registration endpoint
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
  body('dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('gender').isIn(['Male', 'Female', 'Other']).withMessage('Valid gender is required'),
  body('consent').isBoolean().withMessage('Consent must be provided'),
  body('consent').custom(val => val === true).withMessage('You must agree to the terms and conditions')
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

    const { email, password, firstName, lastName, phoneNumber, dateOfBirth, gender, address, emergencyContact, consent } = req.body;

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
      gender,
      address,
      emergencyContact,
      consent,
      consentDate: consent ? new Date() : null
    });

    await patientUser.save();

    // Generate tokens
    const token = generatePatientToken(patientUser);
    const refreshToken = generatePatientRefreshToken(patientUser);

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
          gender: patientUser.gender,
          age: patientUser.age,
          address: patientUser.address,
          emergencyContact: patientUser.emergencyContact,
          isVerified: patientUser.isVerified,
          consent: patientUser.consent,
          consentDate: patientUser.consentDate
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
    const token = generatePatientToken(patientUser);
    const refreshToken = generatePatientRefreshToken(patientUser);

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
          gender: patientUser.gender,
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

// Patient refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    const decoded = verifyPatientRefreshToken(refreshToken);
    const patientUser = await PatientUser.findById(decoded.id);

    if (!patientUser || !patientUser.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    const newToken = generatePatientToken(patientUser);
    const newRefreshToken = generatePatientRefreshToken(patientUser);

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Patient refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
});

// Patient profile endpoint
router.get('/profile', authenticatePatient, async (req, res) => {
  try {
    const patientUser = await PatientUser.findById(req.patient.id)
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
router.put('/profile', authenticatePatient, [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phoneNumber').optional().trim().notEmpty(),
  body('email').optional().isEmail().normalizeEmail(),
  body('occupation').optional().trim(),
  body('civilStatus').optional().isIn(['Single', 'Married', 'Divorced', 'Widowed']),
  body('religion').optional().trim(),
  body('referredBy').optional().trim(),
  body('nameOfMother').optional().trim(),
  body('nameOfFather').optional().trim(),
  body('birthWeight').optional().trim(),
  body('birthLength').optional().trim()
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

    // Get the current patient user to check for email changes
    const currentPatientUser = await PatientUser.findById(req.patient.id);
    if (!currentPatientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const oldEmail = currentPatientUser.email;
    const updates = req.body;
    delete updates.password; // Don't allow password updates through this endpoint

    // Check if email is being updated
    const emailChanged = updates.email && updates.email.toLowerCase() !== oldEmail?.toLowerCase();

    // Update patient user
    const patientUser = await PatientUser.findByIdAndUpdate(
      req.patient.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Sync updates to Patient medical record if linked
    if (patientUser.patientRecord) {
      try {
        const patientRecord = await Patient.findById(patientUser.patientRecord);
        if (patientRecord) {
          const patientUpdates = {};
          
          // Update email in contactInfo
          if (emailChanged) {
            patientUpdates['contactInfo.email'] = patientUser.email;
          }
          
          // Update emergency contact
          if (updates.emergencyContact || patientUser.emergencyContact) {
            const ec = patientUser.emergencyContact || {};
            patientUpdates['contactInfo.emergencyContact.name'] = ec.name || '';
            patientUpdates['contactInfo.emergencyContact.relationship'] = ec.relationship || '';
            patientUpdates['contactInfo.emergencyContact.phone'] = ec.phoneNumber || '';
          }
          
          // Convert address object to string format
          if (updates.address) {
            const addressParts = [];
            const addr = patientUser.address || {};
            if (addr.street) addressParts.push(addr.street);
            if (addr.city) addressParts.push(addr.city);
            if (addr.province) addressParts.push(addr.province);
            if (addr.zipCode) addressParts.push(addr.zipCode);
            const addressString = addressParts.join(', ');
            
            if (patientRecord.patientType === 'ob-gyne') {
              patientUpdates['obGyneRecord.address'] = addressString;
            } else if (patientRecord.patientType === 'pediatric') {
              patientUpdates['pediatricRecord.address'] = addressString;
            }
          }
          
          // Update contact number
          if (updates.phoneNumber) {
            if (patientRecord.patientType === 'ob-gyne') {
              patientUpdates['obGyneRecord.contactNumber'] = patientUser.phoneNumber;
            } else if (patientRecord.patientType === 'pediatric') {
              patientUpdates['pediatricRecord.contactNumber'] = patientUser.phoneNumber;
            }
          }
          
          // Update birthDate and calculate age (always recalculate to ensure it's current)
          const birthDate = patientUser.dateOfBirth;
          if (birthDate) {
            // Calculate age
            const today = new Date();
            const birth = new Date(birthDate);
            let age = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
              age--;
            }
            
            if (patientRecord.patientType === 'ob-gyne') {
              // Always update birthDate and age to keep them in sync
              patientUpdates['obGyneRecord.birthDate'] = birthDate;
              patientUpdates['obGyneRecord.age'] = age;
            } else if (patientRecord.patientType === 'pediatric') {
              patientUpdates['pediatricRecord.birthDate'] = birthDate;
              patientUpdates['pediatricRecord.age'] = age.toString();
            }
          }
          
          // Update patient name (firstName + lastName)
          if (updates.firstName || updates.lastName) {
            const fullName = `${patientUser.firstName} ${patientUser.lastName}`.trim();
            if (patientRecord.patientType === 'ob-gyne') {
              patientUpdates['obGyneRecord.patientName'] = fullName;
            } else if (patientRecord.patientType === 'pediatric') {
              patientUpdates['pediatricRecord.nameOfChildren'] = fullName;
            }
          }
          
          // OB-GYNE specific fields
          if (patientRecord.patientType === 'ob-gyne') {
            if (updates.occupation !== undefined) {
              patientUpdates['obGyneRecord.occupation'] = patientUser.occupation || '';
            }
            if (updates.civilStatus !== undefined) {
              patientUpdates['obGyneRecord.civilStatus'] = patientUser.civilStatus || '';
            }
            if (updates.religion !== undefined) {
              patientUpdates['obGyneRecord.religion'] = patientUser.religion || '';
            }
            if (updates.referredBy !== undefined) {
              patientUpdates['obGyneRecord.referredBy'] = patientUser.referredBy || '';
            }
          }
          
          // Pediatric specific fields
          if (patientRecord.patientType === 'pediatric') {
            if (updates.nameOfMother !== undefined) {
              patientUpdates['pediatricRecord.nameOfMother'] = patientUser.nameOfMother || '';
            }
            if (updates.nameOfFather !== undefined) {
              patientUpdates['pediatricRecord.nameOfFather'] = patientUser.nameOfFather || '';
            }
            if (updates.birthWeight !== undefined) {
              patientUpdates['pediatricRecord.birthWeight'] = patientUser.birthWeight || '';
            }
            if (updates.birthLength !== undefined) {
              patientUpdates['pediatricRecord.birthLength'] = patientUser.birthLength || '';
            }
            // Update sex from gender
            if (updates.gender !== undefined) {
              const genderMap = { 'Male': 'Male', 'Female': 'Female', 'Other': 'Male' }; // Default Other to Male
              patientUpdates['pediatricRecord.sex'] = genderMap[patientUser.gender] || 'Male';
            }
          }
          
          // Apply all updates
          if (Object.keys(patientUpdates).length > 0) {
            await Patient.findByIdAndUpdate(
              patientUser.patientRecord,
              { $set: patientUpdates },
              { runValidators: true }
            );
            console.log(`Updated Patient record ${patientUser.patientRecord} with fields:`, Object.keys(patientUpdates));
          }
        }
      } catch (updateError) {
        console.error('Error updating Patient record:', updateError);
        // Don't fail the request if Patient record update fails, but log it
      }
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
router.put('/change-password', authenticatePatient, [
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
    const patientUser = await PatientUser.findById(req.patient.id);

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
