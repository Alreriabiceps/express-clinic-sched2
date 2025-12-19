import express from 'express';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = express.Router();

// Create new patient
router.post('/', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const { patientType, record } = req.body;
    
    // Validate required fields
    if (!patientType) {
      return res.status(400).json({ message: 'Patient type is required' });
    }
    
    if (!record) {
      return res.status(400).json({ message: 'Patient record is required' });
    }

    // Prepare patient data based on type
    let patientData = {
      patientType: patientType
    };

    // Map record to the appropriate field based on patient type
    if (patientType === 'ob-gyne') {
      if (!record.patientName) {
        return res.status(400).json({ message: 'Patient name is required for OB-GYNE patients' });
      }
      patientData.obGyneRecord = record;
      
      // Check if patient already exists (OB-GYNE)
      const existingPatient = await Patient.findOne({
        patientType: 'ob-gyne',
        $or: [
          { 'obGyneRecord.patientName': record.patientName },
          { 'obGyneRecord.contactNumber': record.contactNumber }
        ]
      });

      if (existingPatient) {
        return res.status(400).json({ message: 'Patient with this name or contact number already exists' });
      }
    } else if (patientType === 'pediatric') {
      if (!record.nameOfChildren) {
        return res.status(400).json({ message: 'Child name is required for pediatric patients' });
      }
      patientData.pediatricRecord = record;
      
      // Check if patient already exists (Pediatric)
      const existingPatient = await Patient.findOne({
        patientType: 'pediatric',
        $or: [
          { 'pediatricRecord.nameOfChildren': record.nameOfChildren },
          { 'pediatricRecord.contactNumber': record.contactNumber }
        ]
      });

      if (existingPatient) {
        return res.status(400).json({ message: 'Patient with this name or contact number already exists' });
      }
    } else {
      return res.status(400).json({ message: 'Invalid patient type. Must be "pediatric" or "ob-gyne"' });
    }

    // Generate patientId (will be handled by pre-save hook in model)
    // For now, we'll let the model handle it
    const patient = new Patient(patientData);
    await patient.save();
    
    res.status(201).json({
      message: 'Patient created successfully',
      patient: {
        _id: patient._id,
        patientId: patient.patientId,
        patientType: patient.patientType,
        patientNumber: patient.patientNumber,
        obGyneRecord: patient.obGyneRecord,
        pediatricRecord: patient.pediatricRecord
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
      // Search across multiple fields for both patient types
      searchQuery.$or = [
        // Patient ID and number
        { patientId: { $regex: query, $options: 'i' } },
        { patientNumber: { $regex: query, $options: 'i' } },
        // OB-GYNE patient fields
        { 'obGyneRecord.patientName': { $regex: query, $options: 'i' } },
        { 'obGyneRecord.contactNumber': { $regex: query, $options: 'i' } },
        // Pediatric patient fields
        { 'pediatricRecord.nameOfChildren': { $regex: query, $options: 'i' } },
        { 'pediatricRecord.nameOfMother': { $regex: query, $options: 'i' } },
        { 'pediatricRecord.nameOfFather': { $regex: query, $options: 'i' } },
        { 'pediatricRecord.contactNumber': { $regex: query, $options: 'i' } },
        // Contact info (if exists)
        { 'contactInfo.email': { $regex: query, $options: 'i' } },
        { 'contactInfo.phoneNumber': { $regex: query, $options: 'i' } }
      ];
    }
    
    if (type) {
      searchQuery.patientType = type;
    }

    const skip = (page - 1) * limit;
    const patients = await Patient.find(searchQuery)
      .select('patientId patientType pediatricRecord.nameOfChildren pediatricRecord.nameOfMother pediatricRecord.contactNumber obGyneRecord.patientName obGyneRecord.contactNumber contactInfo status createdAt updatedAt noShowCount appointmentLocked')
      .sort({ updatedAt: -1, createdAt: -1 })
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
      .select('patientId patientType pediatricRecord.nameOfChildren pediatricRecord.nameOfMother pediatricRecord.contactNumber obGyneRecord.patientName obGyneRecord.contactNumber contactInfo status createdAt updatedAt noShowCount appointmentLocked')
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

    // Prepare consultation data based on patient type
    let consultationData;
    
    if (patient.patientType === 'pediatric') {
      if (!patient.pediatricRecord) {
        return res.status(400).json({ message: 'Pediatric record not found for this patient' });
      }
      if (!patient.pediatricRecord.consultations) {
        patient.pediatricRecord.consultations = [];
      }
      // Pediatric consultation schema: date, historyAndPE, natureTxn, impression
      consultationData = {
        date: req.body.date ? new Date(req.body.date) : new Date(),
        historyAndPE: req.body.historyAndPE || "",
        natureTxn: req.body.natureTxn || "",
        impression: req.body.impression || ""
      };
      patient.pediatricRecord.consultations.push(consultationData);
    } else {
      if (!patient.obGyneRecord) {
        return res.status(400).json({ message: 'OB-GYNE record not found for this patient' });
      }
      if (!patient.obGyneRecord.consultations) {
        patient.obGyneRecord.consultations = [];
      }
      // OB-GYNE consultation includes recordedBy
      consultationData = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        recordedBy: req.user.id
      };
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

// Update consultation record
router.put('/:id/consultations/:consultationId', authenticateToken, requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    let consultations;
    if (patient.patientType === 'pediatric') {
      if (!patient.pediatricRecord || !patient.pediatricRecord.consultations) {
        return res.status(400).json({ message: 'Consultation records not found for this patient' });
      }
      consultations = patient.pediatricRecord.consultations;
    } else {
      if (!patient.obGyneRecord || !patient.obGyneRecord.consultations) {
        return res.status(400).json({ message: 'Consultation records not found for this patient' });
      }
      consultations = patient.obGyneRecord.consultations;
    }

    const consultationIndex = consultations.findIndex(
      cons => cons._id.toString() === req.params.consultationId
    );

    if (consultationIndex === -1) {
      return res.status(404).json({ message: 'Consultation record not found' });
    }

    // Update the consultation record
    if (patient.patientType === 'pediatric') {
      consultations[consultationIndex] = {
        ...consultations[consultationIndex].toObject(),
        date: req.body.date ? new Date(req.body.date) : consultations[consultationIndex].date,
        historyAndPE: req.body.historyAndPE !== undefined ? req.body.historyAndPE : consultations[consultationIndex].historyAndPE,
        natureTxn: req.body.natureTxn !== undefined ? req.body.natureTxn : consultations[consultationIndex].natureTxn,
        impression: req.body.impression !== undefined ? req.body.impression : consultations[consultationIndex].impression
      };
    } else {
      consultations[consultationIndex] = {
        ...consultations[consultationIndex].toObject(),
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : consultations[consultationIndex].date
      };
    }

    await patient.save();

    res.json({
      message: 'Consultation record updated successfully',
      patient
    });
  } catch (error) {
    console.error('Error updating consultation:', error);
    res.status(400).json({ message: 'Error updating consultation record', error: error.message });
  }
});

// Delete consultation record
router.delete('/:id/consultations/:consultationId', authenticateToken, requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    let consultations;
    if (patient.patientType === 'pediatric') {
      if (!patient.pediatricRecord || !patient.pediatricRecord.consultations) {
        return res.status(400).json({ message: 'Consultation records not found for this patient' });
      }
      consultations = patient.pediatricRecord.consultations;
    } else {
      if (!patient.obGyneRecord || !patient.obGyneRecord.consultations) {
        return res.status(400).json({ message: 'Consultation records not found for this patient' });
      }
      consultations = patient.obGyneRecord.consultations;
    }

    const consultationIndex = consultations.findIndex(
      cons => cons._id.toString() === req.params.consultationId
    );

    if (consultationIndex === -1) {
      return res.status(404).json({ message: 'Consultation record not found' });
    }

    // Remove the consultation record
    consultations.splice(consultationIndex, 1);
    await patient.save();

    res.json({
      message: 'Consultation record deleted successfully',
      patient
    });
  } catch (error) {
    console.error('Error deleting consultation:', error);
    res.status(400).json({ message: 'Error deleting consultation record', error: error.message });
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
      vaccine: req.body.vaccine,
      vaccineName: req.body.vaccineName || req.body.vaccine,
      date: req.body.date ? new Date(req.body.date) : new Date(),
      remarks: req.body.remarks,
      notes: req.body.notes || req.body.remarks,
      batchNumber: req.body.batchNumber,
      manufacturer: req.body.manufacturer,
      site: req.body.site,
      route: req.body.route,
      administeredBy: req.user.id
    };

    // Use immunizationRecords array instead of immunizations object
    if (!patient.pediatricRecord.immunizationRecords) {
      patient.pediatricRecord.immunizationRecords = [];
    }
    
    patient.pediatricRecord.immunizationRecords.push(immunizationData);
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

// Update immunization record (pediatric only)
router.put('/:id/immunizations/:immunizationId', authenticateToken, requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.patientType !== 'pediatric') {
      return res.status(400).json({ message: 'Immunization records are only for pediatric patients' });
    }

    if (!patient.pediatricRecord || !patient.pediatricRecord.immunizationRecords) {
      return res.status(400).json({ message: 'Immunization records not found for this patient' });
    }

    const immunizationIndex = patient.pediatricRecord.immunizationRecords.findIndex(
      imm => imm._id.toString() === req.params.immunizationId
    );

    if (immunizationIndex === -1) {
      return res.status(404).json({ message: 'Immunization record not found' });
    }

    // Update the immunization record
    patient.pediatricRecord.immunizationRecords[immunizationIndex] = {
      ...patient.pediatricRecord.immunizationRecords[immunizationIndex].toObject(),
      vaccine: req.body.vaccine || patient.pediatricRecord.immunizationRecords[immunizationIndex].vaccine,
      vaccineName: req.body.vaccineName || req.body.vaccine || patient.pediatricRecord.immunizationRecords[immunizationIndex].vaccineName,
      date: req.body.date ? new Date(req.body.date) : patient.pediatricRecord.immunizationRecords[immunizationIndex].date,
      remarks: req.body.remarks !== undefined ? req.body.remarks : patient.pediatricRecord.immunizationRecords[immunizationIndex].remarks,
      notes: req.body.notes !== undefined ? req.body.notes : patient.pediatricRecord.immunizationRecords[immunizationIndex].notes,
      batchNumber: req.body.batchNumber !== undefined ? req.body.batchNumber : patient.pediatricRecord.immunizationRecords[immunizationIndex].batchNumber,
      manufacturer: req.body.manufacturer !== undefined ? req.body.manufacturer : patient.pediatricRecord.immunizationRecords[immunizationIndex].manufacturer,
      site: req.body.site !== undefined ? req.body.site : patient.pediatricRecord.immunizationRecords[immunizationIndex].site,
      route: req.body.route !== undefined ? req.body.route : patient.pediatricRecord.immunizationRecords[immunizationIndex].route,
    };

    await patient.save();

    res.json({
      message: 'Immunization record updated successfully',
      patient
    });
  } catch (error) {
    console.error('Error updating immunization:', error);
    res.status(400).json({ message: 'Error updating immunization record', error: error.message });
  }
});

// Delete immunization record (pediatric only)
router.delete('/:id/immunizations/:immunizationId', authenticateToken, requireRole(['admin', 'doctor']), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.patientType !== 'pediatric') {
      return res.status(400).json({ message: 'Immunization records are only for pediatric patients' });
    }

    if (!patient.pediatricRecord || !patient.pediatricRecord.immunizationRecords) {
      return res.status(400).json({ message: 'Immunization records not found for this patient' });
    }

    const immunizationIndex = patient.pediatricRecord.immunizationRecords.findIndex(
      imm => imm._id.toString() === req.params.immunizationId
    );

    if (immunizationIndex === -1) {
      return res.status(404).json({ message: 'Immunization record not found' });
    }

    // Remove the immunization record
    patient.pediatricRecord.immunizationRecords.splice(immunizationIndex, 1);
    await patient.save();

    res.json({
      message: 'Immunization record deleted successfully',
      patient
    });
  } catch (error) {
    console.error('Error deleting immunization:', error);
    res.status(400).json({ message: 'Error deleting immunization record', error: error.message });
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
      .select('patientId patientType pediatricRecord.nameOfChildren pediatricRecord.nameOfMother pediatricRecord.contactNumber obGyneRecord.patientName obGyneRecord.contactNumber contactInfo status createdAt updatedAt noShowCount appointmentLocked')
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