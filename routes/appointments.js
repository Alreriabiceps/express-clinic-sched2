import express from "express";
import { body, query, validationResult } from "express-validator";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import PatientUser from "../models/PatientUser.js";
import { authenticateToken, requireStaff } from "../middleware/auth.js";

const router = express.Router();

// Get all appointments with filtering and pagination
router.get("/", [authenticateToken, requireStaff], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};

    if (req.query.date) {
      const date = new Date(req.query.date);
      filter.appointmentDate = {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      };
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.doctorType) {
      filter.doctorType = req.query.doctorType;
    }

    if (req.query.doctorName) {
      filter.doctorName = req.query.doctorName;
    }

    // Add this block to filter by patientId
    if (req.query.patientId) {
      console.log(
        "🔍 Filtering appointments by patientId:",
        req.query.patientId
      );
      const patient = await Patient.findOne({ patientId: req.query.patientId });
      if (patient) {
        console.log(
          "✅ Found patient:",
          patient.patientId,
          "ObjectId:",
          patient._id
        );
        filter.patient = patient._id;
      } else {
        console.log("❌ Patient not found for patientId:", req.query.patientId);
        // If patient not found, return empty result
        return res.json({
          success: true,
          data: {
            appointments: [],
            pagination: {
              current: page,
              pages: 0,
              total: 0,
              hasNext: false,
              hasPrev: false,
            },
          },
        });
      }
    }

    console.log("🔍 Final filter object:", JSON.stringify(filter, null, 2));

    const appointments = await Appointment.find(filter)
      .populate(
        "patient",
        "patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName"
      )
      .populate("patientUserId", "fullName email phoneNumber")
      .populate("bookedBy", "firstName lastName")
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Appointment.countDocuments(filter);

    res.json({
      success: true,
      data: {
        appointments,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Get appointments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving appointments",
    });
  }
});

// Get single appointment
router.get("/:id", [authenticateToken, requireStaff], async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate("patient")
      .populate("bookedBy", "firstName lastName")
      .populate("confirmedBy", "firstName lastName");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.json({
      success: true,
      data: { appointment },
    });
  } catch (error) {
    console.error("Get appointment error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving appointment",
    });
  }
});

// Create new appointment
router.post(
  "/",
  [
    authenticateToken,
    requireStaff,
    body("patientId").notEmpty().withMessage("Patient ID is required"),
    body("doctorType")
      .isIn(["ob-gyne", "pediatric"])
      .withMessage("Valid doctor type is required"),
    body("doctorName")
      .isIn(["Dr. Maria Sarah L. Manaloto", "Dr. Shara Laine S. Vino"])
      .withMessage("Valid doctor name is required"),
    body("appointmentDate")
      .isISO8601()
      .withMessage("Valid appointment date is required"),
    body("appointmentTime")
      .matches(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i)
      .withMessage("Valid appointment time is required"),
    body("serviceType").notEmpty().withMessage("Service type is required"),
    // Phone will be defaulted from the patient record if missing
    body("contactInfo.primaryPhone").optional(),
    body("reasonForVisit")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Reason for visit too long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const {
        patientId,
        doctorType,
        doctorName,
        appointmentDate,
        appointmentTime,
        serviceType,
        contactInfo,
        reasonForVisit,
        symptoms,
        appointmentType,
        priority,
        patientInstructions,
        staffNotes,
      } = req.body;

      // Find patient
      const patient = await Patient.findOne({ patientId, isActive: true });
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found",
        });
      }

      // Validate doctor type matches patient type
      if (
        (doctorType === "pediatric" && patient.patientType !== "pediatric") ||
        (doctorType === "ob-gyne" && patient.patientType !== "ob-gyne")
      ) {
        return res.status(400).json({
          success: false,
          message: "Doctor type does not match patient type",
        });
      }

      // Derive required display fields from patient record
      const derivedPatientName =
        patient.patientType === "ob-gyne"
          ? patient.obGyneRecord?.patientName || ""
          : patient.pediatricRecord?.nameOfChildren || "";
      const derivedContactNumber =
        patient.patientType === "ob-gyne"
          ? patient.obGyneRecord?.contactNumber || ""
          : patient.pediatricRecord?.contactNumber || "";

      // Provide safe default for serviceType if missing
      const safeServiceType =
        serviceType && serviceType.length > 0
          ? serviceType
          : patient.patientType === "ob-gyne"
          ? "PRENATAL_CHECKUP"
          : "WELL_CHILD_CHECKUP";

      // Normalize legacy/general labels to valid enum
      const normalizedServiceType = (() => {
        if (!safeServiceType)
          return patient.patientType === "ob-gyne"
            ? "PRENATAL_CHECKUP"
            : "WELL_CHILD_CHECKUP";
        if (safeServiceType === "REGULAR_CHECKUP") {
          return patient.patientType === "ob-gyne"
            ? "PRENATAL_CHECKUP"
            : "WELL_CHILD_CHECKUP";
        }
        return safeServiceType;
      })();

      // Check for existing appointment at the same time
      const existingAppointment = await Appointment.findOne({
        doctorName,
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        status: { $in: ["scheduled", "confirmed"] },
      });

      if (existingAppointment) {
        return res.status(400).json({
          success: false,
          message: "Time slot already booked",
        });
      }

      // Create appointment
      const appointment = new Appointment({
        patient: patient._id,
        doctorType,
        doctorName,
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        serviceType: normalizedServiceType,
        contactInfo:
          contactInfo && contactInfo.primaryPhone
            ? contactInfo
            : { primaryPhone: derivedContactNumber || "" },
        reasonForVisit,
        symptoms,
        appointmentType: appointmentType || "regular",
        priority: priority || "normal",
        patientInstructions,
        staffNotes,
        bookedBy: req.user._id,
        // Required by schema for staff bookings
        patientName: derivedPatientName,
        contactNumber: derivedContactNumber || contactInfo?.primaryPhone || "",
        bookingSource: "staff",
      });

      await appointment.save();

      const populatedAppointment = await Appointment.findById(appointment._id)
        .populate(
          "patient",
          "patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName"
        )
        .populate("bookedBy", "firstName lastName");

      res.status(201).json({
        success: true,
        message: "Appointment booked successfully",
        data: { appointment: populatedAppointment },
      });
    } catch (error) {
      console.error("Create appointment error:", error);
      res.status(500).json({
        success: false,
        message: "Server error creating appointment",
      });
    }
  }
);

// Update appointment status
router.patch(
  "/:id/status",
  [
    authenticateToken,
    requireStaff,
    body("status")
      .isIn([
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no-show",
        "rescheduled",
      ])
      .withMessage("Valid status is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { status, cancellationReason, staffNotes } = req.body;

      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      appointment.status = status;

      if (status === "confirmed") {
        appointment.confirmedBy = req.user._id;

        // Update patient status to 'Active' when appointment is confirmed
        if (appointment.patient) {
          const patient = await Patient.findById(appointment.patient);
          if (patient && patient.status === "New") {
            patient.status = "Active";
            await patient.save();
          }
        }
      }

      if (status === "cancelled" && cancellationReason) {
        appointment.cancellationReason = cancellationReason;
      }

      if (staffNotes) {
        appointment.staffNotes = staffNotes;
      }

      await appointment.save();

      const updatedAppointment = await Appointment.findById(appointment._id)
        .populate(
          "patient",
          "patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName"
        )
        .populate("bookedBy", "firstName lastName")
        .populate("confirmedBy", "firstName lastName");

      res.json({
        success: true,
        message: `Appointment ${status} successfully`,
        data: { appointment: updatedAppointment },
      });
    } catch (error) {
      console.error("Update appointment status error:", error);
      res.status(500).json({
        success: false,
        message: "Server error updating appointment",
      });
    }
  }
);

// Reschedule appointment
router.patch(
  "/:id/reschedule",
  [
    authenticateToken,
    requireStaff,
    body("newDate").isISO8601().withMessage("Valid new date is required"),
    body("newTime")
      .matches(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i)
      .withMessage("Valid new time is required"),
    body("reason")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Reason too long"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { newDate, newTime, reason } = req.body;

      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      // Check for conflicts
      const existingAppointment = await Appointment.findOne({
        _id: { $ne: appointment._id },
        doctorName: appointment.doctorName,
        appointmentDate: new Date(newDate),
        appointmentTime: newTime,
        status: { $in: ["scheduled", "confirmed"] },
      });

      if (existingAppointment) {
        return res.status(400).json({
          success: false,
          message: "New time slot already booked",
        });
      }

      // Store original appointment details
      appointment.rescheduledFrom = {
        originalDate: appointment.appointmentDate,
        originalTime: appointment.appointmentTime,
        reason: reason || "Rescheduled by staff",
      };

      appointment.appointmentDate = new Date(newDate);
      appointment.appointmentTime = newTime;
      appointment.status = "rescheduled";

      await appointment.save();

      const updatedAppointment = await Appointment.findById(appointment._id)
        .populate(
          "patient",
          "patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName"
        )
        .populate("bookedBy", "firstName lastName");

      res.json({
        success: true,
        message: "Appointment rescheduled successfully",
        data: { appointment: updatedAppointment },
      });
    } catch (error) {
      console.error("Reschedule appointment error:", error);
      res.status(500).json({
        success: false,
        message: "Server error rescheduling appointment",
      });
    }
  }
);

// Get daily appointments for a specific doctor
router.get("/daily", [authenticateToken, requireStaff], async (req, res) => {
  try {
    const { doctorName } = req.query;
    const date = req.query.date ? new Date(req.query.date) : new Date();

    if (!doctorName) {
      return res.status(400).json({
        success: false,
        message: "Doctor name is required",
      });
    }

    const appointments = await Appointment.find({
      doctorName,
      appointmentDate: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1),
      },
      status: { $ne: "cancelled" },
    })
      .populate(
        "patient",
        "patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName"
      )
      .populate("patientUserId", "fullName email phoneNumber")
      .sort({ appointmentTime: 1 });

    res.json({
      success: true,
      data: {
        doctor: doctorName,
        date: date.toISOString().split("T")[0],
        appointments,
        count: appointments.length,
      },
    });
  } catch (error) {
    console.error("Get daily appointments error:", error);
    res.status(500).json({
      success: false,
      message: "Server error retrieving daily appointments",
    });
  }
});

// Update appointment diagnosis
router.patch(
  "/:id/diagnosis",
  [authenticateToken, requireStaff],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { diagnosis } = req.body;

      const appointment = await Appointment.findByIdAndUpdate(
        id,
        { diagnosis },
        { new: true }
      );

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      res.json({
        success: true,
        data: appointment,
        message: "Diagnosis updated successfully",
      });
    } catch (error) {
      console.error("Error updating diagnosis:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update diagnosis",
      });
    }
  }
);

export default router;
