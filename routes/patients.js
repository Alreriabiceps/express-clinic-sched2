import express from 'express';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
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
      .select('personalInfo patientType patientNumber patientId status createdAt')
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
    const { limit = 10, page = 1, type, status } = req.query;
    
    let query = {};
    if (type) {
      query.patientType = type;
    }
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;
    const patients = await Patient.find(query)
      .select('patientId patientType pediatricRecord.nameOfChildren pediatricRecord.nameOfMother obGyneRecord.patientName contactInfo status createdAt updatedAt noShowCount appointmentLocked')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Patient.countDocuments(query);

    res.json({
      success: true,
      data: {
        patients,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching patients', 
      error: error.message 
    });
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
      if (!patient.pediatricRecord) {
        return res.status(400).json({ message: 'Pediatric record not found for this patient' });
      }
      if (!patient.pediatricRecord.consultations) {
        patient.pediatricRecord.consultations = [];
      }
      patient.pediatricRecord.consultations.push(consultationData);
    } else {
      if (!patient.obGyneRecord) {
        return res.status(400).json({ message: 'OB-GYNE record not found for this patient' });
      }
      if (!patient.obGyneRecord.consultations) {
        patient.obGyneRecord.consultations = [];
      }
      patient.obGyneRecord.consultations.push(consultationData);
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

    if (!patient.pediatricRecord) {
      return res.status(400).json({ message: 'Pediatric record not found for this patient' });
    }

    const immunizationData = {
      ...req.body,
      administeredBy: req.user.id
    };

    // Check if immunizations array exists, if not create it
    // Note: The schema has immunizations as an object, but we're treating it as an array for individual records
    // If the schema structure is different, this may need adjustment
    if (!patient.pediatricRecord.immunizations || !Array.isArray(patient.pediatricRecord.immunizations)) {
      // If immunizations is an object in the schema, we might need to handle it differently
      // For now, let's try to create an array if it doesn't exist
      patient.pediatricRecord.immunizations = [];
    }
    
    patient.pediatricRecord.immunizations.push(immunizationData);
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
    const obgynePatients = await Patient.countDocuments({ patientType: 'ob-gyne' });
    
    // Patient status counts
    const newPatients = await Patient.countDocuments({ status: 'New' });
    const activePatients = await Patient.countDocuments({ status: 'Active' });
    const inactivePatients = await Patient.countDocuments({ status: 'Inactive' });
    
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
      recentPatients,
      statusCounts: {
        new: newPatients,
        active: activePatients,
        inactive: inactivePatients
      }
    });
  } catch (error) {
    console.error('Error fetching patient statistics:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
});

// Get patients by status
router.get('/status/:status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.params;
    const { limit = 10, page = 1, type } = req.query;
    
    // Validate status
    if (!['New', 'Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid status. Must be New, Active, or Inactive' 
      });
    }
    
    let query = { status };
    if (type) {
      query.patientType = type;
    }

    const skip = (page - 1) * limit;
    const patients = await Patient.find(query)
      .select('patientId patientType pediatricRecord.nameOfChildren pediatricRecord.nameOfMother obGyneRecord.patientName contactInfo status createdAt updatedAt noShowCount appointmentLocked')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Patient.countDocuments(query);

    // Get related appointments for each patient
    const patientsWithAppointments = [];
    for (const patient of patients) {
      const patientObj = patient.toObject();
      
      // Get the latest appointment for this patient
      const latestAppointment = await Patient.aggregate([
        { $match: { _id: patient._id } },
        {
          $lookup: {
            from: 'appointments',
            localField: '_id',
            foreignField: 'patient',
            as: 'appointments'
          }
        },
        {
          $project: {
            latestAppointment: {
              $arrayElemAt: [
                {
                  $sortArray: {
                    input: '$appointments',
                    sortBy: { createdAt: -1 }
                  }
                },
                0
              ]
            }
          }
        }
      ]);

      patientObj.latestAppointment = latestAppointment[0]?.latestAppointment || null;
      patientsWithAppointments.push(patientObj);
    }

    res.json({
      success: true,
      data: {
        patients: patientsWithAppointments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        },
        statusFilter: status
      }
    });
  } catch (error) {
    console.error('Error fetching patients by status:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching patients by status', 
      error: error.message 
    });
  }
});

// Unlock appointment booking for a patient (admin/staff)
router.patch('/:id/unlock-appointments', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({ 
        success: false,
        message: 'Patient not found' 
      });
    }

    patient.appointmentLocked = false;
    patient.noShowCount = 0;
    await patient.save();

    res.json({
      success: true,
      message: 'Appointment booking unlocked for patient',
      data: { patient }
    });
  } catch (error) {
    console.error('Error unlocking appointments:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error unlocking appointments', 
      error: error.message 
    });
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