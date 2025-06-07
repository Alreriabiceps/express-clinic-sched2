import express from 'express';
import Patient from '../models/Patient.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = express.Router();

// Create new patient
router.post('/', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const patientData = req.body;
    
    // Check if patient already exists
    const existingPatient = await Patient.findOne({
      $or: [
        { 'personalInfo.firstName': patientData.personalInfo.firstName, 'personalInfo.lastName': patientData.personalInfo.lastName },
        { 'personalInfo.contactNumber': patientData.personalInfo.contactNumber }
      ]
    });

    if (existingPatient) {
      return res.status(400).json({ message: 'Patient with this name or contact number already exists' });
    }

    const patient = new Patient(patientData);
    await patient.save();
    
    res.status(201).json({
      message: 'Patient created successfully',
      patient: {
        _id: patient._id,
        personalInfo: patient.personalInfo,
        patientType: patient.patientType,
        patientNumber: patient.patientNumber
      }
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(400).json({ message: 'Error creating patient', error: error.message });
  }
});

// Search patients
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query, type, limit = 10, page = 1 } = req.query;
    
    let searchQuery = {};
    
    if (query) {
      searchQuery.$or = [
        { 'personalInfo.firstName': { $regex: query, $options: 'i' } },
        { 'personalInfo.lastName': { $regex: query, $options: 'i' } },
        { patientNumber: { $regex: query, $options: 'i' } },
        { 'personalInfo.contactNumber': { $regex: query, $options: 'i' } }
      ];
    }
    
    if (type) {
      searchQuery.patientType = type;
    }

    const skip = (page - 1) * limit;
    const patients = await Patient.find(searchQuery)
      .select('personalInfo patientType patientNumber createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Patient.countDocuments(searchQuery);

    res.json({
      patients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching patients:', error);
    res.status(500).json({ message: 'Error searching patients', error: error.message });
  }
});

// Get all patients with pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, page = 1, type } = req.query;
    
    let query = {};
    if (type) {
      query.patientType = type;
    }

    const skip = (page - 1) * limit;
    const patients = await Patient.find(query)
      .select('personalInfo patientType patientNumber createdAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Patient.countDocuments(query);

    res.json({
      patients,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Error fetching patients', error: error.message });
  }
});

// Get patient by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ message: 'Error fetching patient', error: error.message });
  }
});

// Update patient
router.put('/:id', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({
      message: 'Patient updated successfully',
      patient
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(400).json({ message: 'Error updating patient', error: error.message });
  }
});

// Add consultation record
router.post('/:id/consultations', authenticateToken, requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const consultationData = {
      ...req.body,
      recordedBy: req.user.id
    };

    if (patient.patientType === 'pediatric') {
      patient.pediatricInfo.consultations.push(consultationData);
    } else {
      patient.obgyneInfo.consultations.push(consultationData);
    }

    await patient.save();

    res.status(201).json({
      message: 'Consultation record added successfully',
      patient
    });
  } catch (error) {
    console.error('Error adding consultation:', error);
    res.status(400).json({ message: 'Error adding consultation record', error: error.message });
  }
});

// Add immunization record (pediatric only)
router.post('/:id/immunizations', authenticateToken, requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.patientType !== 'pediatric') {
      return res.status(400).json({ message: 'Immunization records are only for pediatric patients' });
    }

    const immunizationData = {
      ...req.body,
      administeredBy: req.user.id
    };

    patient.pediatricInfo.immunizations.push(immunizationData);
    await patient.save();

    res.status(201).json({
      message: 'Immunization record added successfully',
      patient
    });
  } catch (error) {
    console.error('Error adding immunization:', error);
    res.status(400).json({ message: 'Error adding immunization record', error: error.message });
  }
});

// Get patient statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const totalPatients = await Patient.countDocuments();
    const pediatricPatients = await Patient.countDocuments({ patientType: 'pediatric' });
    const obgynePatients = await Patient.countDocuments({ patientType: 'obgyne' });
    
    // Recent patients (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentPatients = await Patient.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    res.json({
      totalPatients,
      pediatricPatients,
      obgynePatients,
      recentPatients
    });
  } catch (error) {
    console.error('Error fetching patient statistics:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
});

// Delete patient (admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ message: 'Error deleting patient', error: error.message });
  }
});

export default router; 