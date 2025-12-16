import express from "express";
import { body, query, validationResult } from "express-validator";
import Appointment from "../models/Appointment.js";
import Patient from "../models/Patient.js";
import PatientUser from "../models/PatientUser.js";
import Settings from "../models/Settings.js";
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
      .sort({ createdAt: -1, appointmentDate: -1, appointmentTime: -1 }) // Most recently created first, then by appointment date/time
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
    body("doctorType").notEmpty().withMessage("Doctor type is required"),
    body("doctorName").notEmpty().withMessage("Doctor name is required"),
    body("appointmentDate")
      .isISO8601()
      .withMessage("Valid appointment date is required"),
    body("appointmentTime")
      .matches(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i)
      .withMessage("Valid appointment time is required"),
    body("endTime")
      .optional()
      .matches(/^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i)
      .withMessage("Valid end time is required"),
    body("estimatedWaitTime")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Waiting time must be a positive number"),
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
        endTime,
        estimatedWaitTime,
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

      // Try to find linked PatientUser to enable notifications
      let patientUserId = undefined;
      // Check if patient has an email in contact info
      const patientEmail = patient.contactInfo?.email;
      if (patientEmail) {
        const patientUser = await PatientUser.findOne({ email: patientEmail });
        if (patientUser) {
          patientUserId = patientUser._id;
        }
      }

      // Create appointment
      const appointment = new Appointment({
        patient: patient._id,
        patientUserId: patientUserId, // Link to patient user for notifications
        doctorType,
        doctorName,
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        endTime: endTime || undefined,
        estimatedWaitTime: estimatedWaitTime ? parseInt(estimatedWaitTime) : undefined,
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

      const { status, cancellationReason, reason, staffNotes } = req.body;

      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      const previousStatus = appointment.status;

      if (status === "confirmed") {
        appointment.status = status;
        appointment.confirmedBy = req.user._id;

        // Update patient status to 'Active' when appointment is confirmed
        if (appointment.patient) {
          const patient = await Patient.findById(appointment.patient);
          if (patient && patient.status === "New") {
            patient.status = "Active";
            await patient.save();
          }
        }

        // If we are confirming a reschedule pending appointment, it means we are rejecting the reschedule request
        if (previousStatus === 'reschedule_pending' && appointment.rescheduleRequest) {
          appointment.rescheduleRequest.status = 'rejected';
          appointment.rescheduleRequest.reviewedAt = new Date();
          appointment.rescheduleRequest.reviewedBy = req.user._id;
        }

        // Emit socket event for confirmation
        if (req.io && appointment.patientUserId) {
          req.io.emit('appointment:confirmed', {
            type: 'appointment_confirmed',
            message: `Your appointment with ${appointment.doctorName} has been confirmed.`,
            data: {
              id: appointment._id,
              patientName: appointment.patientName,
              doctorName: appointment.doctorName,
              date: appointment.appointmentDate,
              time: appointment.appointmentTime
            }
          });
        }
      } else if (status === "cancelled") {
        // Admin cancellation: Cancel immediately for all appointments (no patient approval needed)
        // The patient will be notified but doesn't need to confirm
        appointment.status = "cancelled";
        if (cancellationReason || reason) {
          appointment.cancellationReason = cancellationReason || reason;
        }
        // Record that this was cancelled by admin/staff
        if (appointment.bookingSource === "patient_portal" && appointment.patientUserId) {
          appointment.cancellationRequest = {
            status: "approved", // Already approved by admin
            reason: cancellationReason || reason || "Cancelled by staff",
            requestedAt: new Date(),
            reviewedAt: new Date(),
            reviewedBy: req.user._id,
            adminNotes: "Cancelled by clinic staff"
          };
        }
        
        // Emit socket event for cancellation
        if (req.io && appointment.patientUserId) {
          req.io.emit('appointment:cancelled', {
            type: 'appointment_cancelled',
            message: `Your appointment with ${appointment.doctorName} has been cancelled.`,
            data: {
              id: appointment._id,
              patientName: appointment.patientName,
              doctorName: appointment.doctorName,
              date: appointment.appointmentDate,
              time: appointment.appointmentTime,
              reason: cancellationReason || reason
            }
          });
        }
      } else {
        appointment.status = status;
        
        // Emit socket events for other statuses
        if (req.io && appointment.patientUserId) {
          if (status === 'rescheduled') {
            req.io.emit('appointment:rescheduled', {
              type: 'appointment_rescheduled',
              message: `Your appointment with ${appointment.doctorName} has been rescheduled.`,
              data: {
                id: appointment._id,
                patientName: appointment.patientName,
                doctorName: appointment.doctorName,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime
              }
            });
          } else if (status === 'completed') {
            req.io.emit('appointment:completed', {
              type: 'appointment_completed',
              message: `Your appointment with ${appointment.doctorName} has been marked as completed.`,
              data: {
                id: appointment._id,
                patientName: appointment.patientName,
                doctorName: appointment.doctorName,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime
              }
            });
          }
        }
      }

      if (staffNotes) {
        appointment.staffNotes = staffNotes;
      }

      // Track no-show counts and lock booking after 3 strikes
      if (status === 'no-show' && previousStatus !== 'no-show' && appointment.patient) {
        const patient = await Patient.findById(appointment.patient);
        if (patient) {
          patient.noShowCount = (patient.noShowCount || 0) + 1;
          patient.lastNoShowAt = new Date();
          if (patient.noShowCount >= 3) {
            patient.appointmentLocked = true;
          }
          await patient.save();
          
          // Emit socket event for no-show
          if (req.io && appointment.patientUserId) {
            req.io.emit('appointment:no_show', {
              type: 'appointment_no_show',
              message: `You have been marked as a no-show for your appointment with ${appointment.doctorName}.`,
              data: {
                id: appointment._id,
                patientName: appointment.patientName,
                doctorName: appointment.doctorName,
                date: appointment.appointmentDate,
                time: appointment.appointmentTime
              }
            });
          }
        }
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

// Approve patient cancellation request
router.patch(
  "/:id/approve-cancellation",
  [authenticateToken, requireStaff],
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "cancellation_pending") {
        return res.status(400).json({
          success: false,
          message: "Appointment is not pending cancellation approval",
        });
      }

      // Check if this is a patient-initiated cancellation request
      if (!appointment.cancellationRequest || !appointment.cancellationRequest.requestedBy) {
        return res.status(400).json({
          success: false,
          message: "This is not a patient-initiated cancellation request",
        });
      }

      // Approve the cancellation
      appointment.status = "cancelled";
      appointment.cancellationRequest.status = "approved";
      appointment.cancellationRequest.reviewedAt = new Date();
      appointment.cancellationRequest.reviewedBy = req.user._id;
      if (req.body.adminNotes) {
        appointment.cancellationRequest.adminNotes = req.body.adminNotes;
      }

      await appointment.save();

      // Emit socket event for cancellation approval
      if (req.io && appointment.patientUserId) {
        req.io.emit('appointment:cancelled', {
          type: 'appointment_cancelled',
          message: `Your cancellation request for appointment with ${appointment.doctorName} has been approved.`,
          data: {
            id: appointment._id,
            patientName: appointment.patientName,
            doctorName: appointment.doctorName,
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
            reason: appointment.cancellationRequest?.reason
          }
        });
      }

      const updatedAppointment = await Appointment.findById(appointment._id)
        .populate(
          "patient",
          "patientId patientType pediatricRecord.nameOfChildren obGyneRecord.patientName"
        )
        .populate("bookedBy", "firstName lastName")
        .populate("confirmedBy", "firstName lastName");

      res.json({
        success: true,
        message: "Cancellation request approved successfully",
        data: { appointment: updatedAppointment },
      });
    } catch (error) {
      console.error("Approve cancellation error:", error);
      res.status(500).json({
        success: false,
        message: "Server error approving cancellation",
      });
    }
  }
);

// Reject patient cancellation request
router.patch(
  "/:id/reject-cancellation",
  [authenticateToken, requireStaff],
  async (req, res) => {
    try {
      const appointment = await Appointment.findById(req.params.id);
      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Appointment not found",
        });
      }

      if (appointment.status !== "cancellation_pending") {
        return res.status(400).json({
          success: false,
          message: "Appointment is not pending cancellation approval",
        });
      }

      // Check if this is a patient-initiated cancellation request
      if (!appointment.cancellationRequest || !appointment.cancellationRequest.requestedBy) {
        return res.status(400).json({
          success: false,
          message: "This is not a patient-initiated cancellation request",
        });
      }

      // Reject the cancellation - restore to previous status (usually confirmed or scheduled)
      const previousStatus = appointment.cancellationRequest.previousStatus || "confirmed";
      appointment.status = previousStatus;
      appointment.cancellationRequest.status = "rejected";
      appointment.cancellationRequest.reviewedAt = new Date();
      appointment.cancellationRequest.reviewedBy = req.user._id;
      if (req.body.adminNotes) {
        appointment.cancellationRequest.adminNotes = req.body.adminNotes;
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
        message: "Cancellation request rejected successfully",
        data: { appointment: updatedAppointment },
      });
    } catch (error) {
      console.error("Reject cancellation error:", error);
      res.status(500).json({
        success: false,
        message: "Server error rejecting cancellation",
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

      // Parse the date string properly to avoid timezone issues
      // newDate is in format "YYYY-MM-DD", create date at UTC noon to avoid timezone shifts
      // Using noon (12:00) ensures the date won't shift to previous day regardless of timezone
      const [year, month, day] = newDate.split('-');
      const parsedDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 12, 0, 0));

      // Validate doctor availability for the new date using Settings
      const dayOfWeek = parsedDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];

      const settings = await Settings.getSettings();
      let doctorSchedule = null;

      // Check if doctor matches OB-GYNE or Pediatrician in settings
      if (settings.obgyneDoctor.name === appointment.doctorName) {
        doctorSchedule = settings.obgyneDoctor.hours[dayName];
      } else if (settings.pediatrician.name === appointment.doctorName) {
        doctorSchedule = settings.pediatrician.hours[dayName];
      }

      // If we found a schedule and the day is not enabled
      if (doctorSchedule && !doctorSchedule.enabled) {
        return res.status(400).json({
          success: false,
          message: `${appointment.doctorName} is not available on ${parsedDate.toLocaleDateString('en-US', { weekday: 'long' })}. Please select a different date.`,
        });
      }
      
      // If we didn't find a schedule (doctor name mismatch), we allow it (fallback behavior)
      // or we could block it, but allowing it is safer for legacy data

      // Check for conflicts
      const existingAppointment = await Appointment.findOne({
        _id: { $ne: appointment._id },
        doctorName: appointment.doctorName,
        appointmentDate: parsedDate,
        appointmentTime: newTime,
        status: { $in: ["scheduled", "confirmed", "reschedule_pending"] },
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

      // If this is a patient portal booking
      if (appointment.bookingSource === "patient_portal" && appointment.patientUserId) {
        // If it's already pending reschedule (patient requested it), this is an admin approval
        if (appointment.status === "reschedule_pending") {
           appointment.appointmentDate = parsedDate;
           appointment.appointmentTime = newTime;
           appointment.status = "confirmed";
           if (appointment.rescheduleRequest) {
             appointment.rescheduleRequest.status = "approved";
             appointment.rescheduleRequest.reviewedAt = new Date();
             appointment.rescheduleRequest.reviewedBy = req.user._id;
           }
        } else {
          // Otherwise, it's a staff-initiated reschedule requiring patient approval
          appointment.rescheduleRequest = {
            status: "pending",
            reason: reason || "Rescheduled by staff",
            requestedAt: new Date(),
            preferredDate: parsedDate,
            preferredTime: newTime,
          };
          appointment.appointmentDate = parsedDate;
          appointment.appointmentTime = newTime;
          appointment.status = "reschedule_pending";
        }
      } else {
        // For staff bookings, reschedule directly
        appointment.appointmentDate = parsedDate;
        appointment.appointmentTime = newTime;
        appointment.status = "confirmed";
      }

      await appointment.save();

      // Emit socket event for reschedule
      if (req.io && appointment.patientUserId) {
        // If it's a request (pending), notify about the request
        if (appointment.status === 'reschedule_pending') {
          req.io.emit('appointment:reschedule_pending', {
            type: 'appointment_reschedule_pending',
            message: `Your reschedule request for appointment with ${appointment.doctorName} is pending approval.`,
            data: {
              id: appointment._id,
              patientName: appointment.patientName,
              doctorName: appointment.doctorName,
              date: appointment.appointmentDate,
              time: appointment.appointmentTime,
              preferredDate: appointment.rescheduleRequest?.preferredDate,
              preferredTime: appointment.rescheduleRequest?.preferredTime
            }
          });
        } else {
          // Direct reschedule
          req.io.emit('appointment:rescheduled', {
            type: 'appointment_rescheduled',
            message: `Your appointment with ${appointment.doctorName} has been rescheduled.`,
            data: {
              id: appointment._id,
              patientName: appointment.patientName,
              doctorName: appointment.doctorName,
              date: appointment.appointmentDate,
              time: appointment.appointmentTime,
              originalDate: appointment.rescheduledFrom?.originalDate,
              originalTime: appointment.rescheduledFrom?.originalTime
            }
          });
        }
      }

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
