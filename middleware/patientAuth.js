import jwt from 'jsonwebtoken';
import PatientUser from '../models/PatientUser.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verify patient JWT token
export const authenticatePatient = async (req, res, next) => {
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
    const patient = await PatientUser.findById(decoded.id).select('-password');

    if (!patient || !patient.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or patient account not active' 
      });
    }

    // Ensure id field is available (convert _id to id)
    req.patient = {
      ...patient.toObject(),
      id: patient._id.toString()
    };
    next();
  } catch (error) {
    console.error('Patient auth middleware error:', error);
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Generate JWT token for patient
export const generatePatientToken = (patient) => {
  return jwt.sign(
    { 
      id: patient._id, 
      email: patient.email,
      type: 'patient'
    },
    JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '24h' 
    }
  );
};

// Generate refresh token for patient
export const generatePatientRefreshToken = (patient) => {
  return jwt.sign(
    { 
      id: patient._id, 
      type: 'patient_refresh' 
    },
    JWT_SECRET,
    { 
      expiresIn: '7d' 
    }
  );
};

// Verify patient refresh token
export const verifyPatientRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'patient_refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
}; 