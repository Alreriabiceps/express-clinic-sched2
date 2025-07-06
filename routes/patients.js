import express from 'express';
import Patient from '../models/Patient.js';
import Appointment from '../models/Appointment.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
const router = express.Router();

// Create new patient (Unified Endpoint)
router.post('/', authenticateToken, requireRole(['admin', 'staff']), async (req, res) => {
  try {
    const patientData = req.body;

    
    // Basic validation
    if (!patientData.patientType || !patientData.record) {
      return res.status(400).json({ message: 'Patient type and record are required.' });
    }

    // Check for existing patient based on name in the record
    const patientName = patientData.patientType === 'ob-gyne' 
        ? patientData.record.patientName 
        : patientData.record.nameOfChildren;

    if (patientName) {
        const existingPatient = await Patient.findOne({
          $or: [
            { 'obGyneRecord.patientName': patientName },
            { 'pediatricRecord.nameOfChildren': patientName }
          ]
        });

        if (existingPatient) {
          return res.status(400).json({ message: `Patient with name "${patientName}" already exists.` });
        }
    }

    // Structure the data for the model
    const newPatientData = {
      patientType: patientData.patientType,
      status: 'New', // Default status
    };

    // Extract emergency contact and add to contactInfo if it exists
    if (patientData.record.emergencyContact) {
      newPatientData.contactInfo = {
        emergencyContact: {
          name: patientData.record.emergencyContact.name,
          phone: patientData.record.emergencyContact.contactNumber,
        }
      };
      // Remove it from record to avoid schema conflict
      delete patientData.record.emergencyContact;
    }

    if (patientData.patientType === 'ob-gyne') {
      newPatientData.obGyneRecord = patientData.record;
    } else if (patientData.patientType === 'pediatric') {
      newPatientData.pediatricRecord = patientData.record;
    } else {
      return res.status(400).json({ message: 'Invalid patient type specified.' });
    }

    const patient = new Patient(newPatientData);
    await patient.save();
    
    res.status(201).json({
      message: 'Patient created successfully',
      patient
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(400).json({ 
      message: 'Error creating patient', 
      error: error.message,
      validationErrors: error.errors || null
    });
  }
});

// Search patients
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { query, type, limit = 10, page = 1 } = req.query;
    
    let searchQuery = {};
    
    if (query) {
      searchQuery.$or = [
        { 'pediatricRecord.nameOfChildren': { $regex: query, $options: 'i' } },
        { 'pediatricRecord.nameOfMother': { $regex: query, $options: 'i' } },
        { 'obGyneRecord.patientName': { $regex: query, $options: 'i' } },
        { patientNumber: { $regex: query, $options: 'i' } },
        { patientId: { $regex: query, $options: 'i' } },
        { 'contactInfo.email': { $regex: query, $options: 'i' } },
        { 'contactInfo.emergencyContact.phone': { $regex: query, $options: 'i' } }
      ];
    }
    
    if (type) {
      searchQuery.patientType = type;
    }

    const skip = (page - 1) * limit;
    const patients = await Patient.find(searchQuery)
      .select('patientId patientType patientNumber pediatricRecord.nameOfChildren pediatricRecord.nameOfMother pediatricRecord.address pediatricRecord.birthDate pediatricRecord.age obGyneRecord.patientName obGyneRecord.address obGyneRecord.birthDate obGyneRecord.age contactInfo status createdAt')
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
      .select('patientId patientType patientNumber pediatricRecord.nameOfChildren pediatricRecord.nameOfMother pediatricRecord.address pediatricRecord.birthDate pediatricRecord.age obGyneRecord.patientName obGyneRecord.address obGyneRecord.birthDate obGyneRecord.age contactInfo status createdAt updatedAt')
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
router.put('/:id', authenticateToken, requireRole(['admin', 'staff', 'doctor']), async (req, res) => {
  try {


    const updateData = {};
    if (req.body.obGyneRecord) {
      // Use dot notation to ensure deep merge of the nested object
      for (const key in req.body.obGyneRecord) {
        updateData[`obGyneRecord.${key}`] = req.body.obGyneRecord[key];
      }
    } else {
        // Handle other update types if necessary
        Object.assign(updateData, req.body);
    }

    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true, context: 'query' }
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
    console.error('Validation error details:', error.errors);
    res.status(400).json({ 
      message: 'Error updating patient', 
      error: error.message,
      details: error.errors 
    });
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
      .select('patientId patientType patientNumber pediatricRecord.nameOfChildren pediatricRecord.nameOfMother pediatricRecord.address pediatricRecord.birthDate pediatricRecord.age obGyneRecord.patientName obGyneRecord.address obGyneRecord.birthDate obGyneRecord.age contactInfo status createdAt updatedAt')
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

// --- Add this script at the end of the file for admin use ---
import mongoose from 'mongoose';

// Utility script to find appointments with missing patients and create patient records
export async function fixOrphanedAppointments() {
  const orphanedAppointments = await Appointment.find({ patient: { $exists: true, $ne: null } }).populate('patient');
  for (const appt of orphanedAppointments) {
    if (!appt.patient) {
      // Try to create a new patient record based on appointment info
      const newPatient = new Patient({
        patientType: appt.doctorType === 'ob-gyne' ? 'ob-gyne' : 'pediatric',
        status: 'Active',
        obGyneRecord: appt.doctorType === 'ob-gyne' ? { patientName: appt.patientName, contactNumber: appt.contactNumber } : undefined,
        pediatricRecord: appt.doctorType === 'pediatric' ? { nameOfChildren: appt.patientName, contactNumber: appt.contactNumber } : undefined
      });
      await newPatient.save();
      appt.patient = newPatient._id;
      await appt.save();
      console.log(`Created patient for orphaned appointment: ${appt._id}`);
    }
  }
  console.log('Orphaned appointment fix complete.');
}

export default router; 