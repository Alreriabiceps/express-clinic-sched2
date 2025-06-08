# Patient Workflow System

## Overview

The clinic now implements an automated patient registration and status management system that integrates appointment booking with patient record management.

## Workflow Process

### 1. Patient Appointment Booking

When a user books an appointment through the patient portal:

- **Automatic Patient Record Creation**: If the patient doesn't exist in the system, a new patient record is automatically created in the `Patients` table
- **Initial Status**: The patient record is assigned a status of `"New"`
- **Appointment Linking**: The appointment is linked to the patient record via `patient_id`
- **Information Sync**: Patient information from the portal registration is automatically synchronized with the medical records

### 2. Admin Appointment Confirmation

When an admin approves/confirms an appointment:

- **Status Update**: The patient's status is automatically updated from `"New"` to `"Active"`
- **Confirmation Tracking**: The system records who confirmed the appointment and when
- **Patient Activation**: The patient is now considered an active patient in the system

### 3. Patient Status Types

- **New**: Patient has booked an appointment but it hasn't been confirmed yet
- **Active**: Patient has at least one confirmed appointment and is an active patient
- **Inactive**: Patient hasn't had recent activity or has been manually set to inactive

## API Endpoints

### Patient Status Management

#### Get Patients by Status

```
GET /api/patients/status/:status
```

Parameters:

- `status`: "New", "Active", or "Inactive"
- `type`: Optional - "pediatric" or "ob-gyne"
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

#### Get Patient Statistics

```
GET /api/patients/stats/overview
```

Returns counts for:

- Total patients
- Patients by type (pediatric/ob-gyne)
- Patients by status (New/Active/Inactive)
- Recent patients (last 30 days)

#### Get All Patients (with filtering)

```
GET /api/patients/
```

Parameters:

- `status`: Optional - filter by status
- `type`: Optional - filter by patient type
- `page`: Page number
- `limit`: Items per page

### Appointment Management

#### Confirm Appointment

```
PATCH /api/appointments/:id/status
```

Body:

```json
{
  "status": "confirmed",
  "staffNotes": "Optional notes"
}
```

When an appointment is confirmed, the linked patient's status is automatically updated to "Active".

## Database Schema Updates

### Patient Model

Added new field:

```javascript
status: {
  type: String,
  enum: ['New', 'Active', 'Inactive'],
  default: 'New'
}
```

### Appointment Model

- Enhanced linking to patient records
- Automatic patient record creation during booking
- Status tracking for confirmation workflow

## Benefits

1. **Automated Registration**: No manual patient registration needed - happens automatically during appointment booking
2. **Status Tracking**: Clear visibility of patient lifecycle from booking to active status
3. **Proper Linking**: All appointments are properly linked to patient medical records
4. **Audit Trail**: Track when patients became active and who confirmed their appointments
5. **Reporting**: Easy reporting on new vs. active patients
6. **Data Integrity**: Ensures all patients who book appointments have corresponding medical records

## Usage for Administrators

1. **Monitor New Patients**: Check `/api/patients/status/New` to see patients who have booked but not been confirmed
2. **Confirm Appointments**: Use the appointment confirmation API to approve appointments and automatically activate patients
3. **Patient Management**: Use the enhanced patient listing endpoints to filter and manage patients by status
4. **Reporting**: Use the statistics endpoint to get overview of patient status distribution

This system ensures that patient data is properly managed from the moment someone books an appointment through their journey as an active patient in the clinic.
