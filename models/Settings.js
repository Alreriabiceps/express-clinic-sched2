import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    clinicName: {
      type: String,
      required: true,
      default: 'VM Mother and Child Clinic'
    },
    bookingEnabled: {
      type: Boolean,
      default: true
    },
    obgyneDoctor: {
      name: {
        type: String,
        required: true,
        default: 'Dr. Maria Sarah L. Manaloto'
      },
      hours: {
        monday: { start: String, end: String, enabled: Boolean },
        tuesday: { start: String, end: String, enabled: Boolean },
        wednesday: { start: String, end: String, enabled: Boolean },
        thursday: { start: String, end: String, enabled: Boolean },
        friday: { start: String, end: String, enabled: Boolean },
        saturday: { start: String, end: String, enabled: Boolean },
        sunday: { start: String, end: String, enabled: Boolean }
      }
    },
    pediatrician: {
      name: {
        type: String,
        required: true,
        default: 'Dr. Shara Laine S. Vino'
      },
      hours: {
        monday: { start: String, end: String, enabled: Boolean },
        tuesday: { start: String, end: String, enabled: Boolean },
        wednesday: { start: String, end: String, enabled: Boolean },
        thursday: { start: String, end: String, enabled: Boolean },
        friday: { start: String, end: String, enabled: Boolean },
        saturday: { start: String, end: String, enabled: Boolean },
        sunday: { start: String, end: String, enabled: Boolean }
      }
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    // Create default settings if none exist
    settings = new this({
      clinicName: 'VM Mother and Child Clinic',
      bookingEnabled: true,
      obgyneDoctor: {
        name: 'Dr. Maria Sarah L. Manaloto',
        hours: {
          monday: { start: '08:00', end: '12:00', enabled: true },
          wednesday: { start: '09:00', end: '14:00', enabled: true },
          friday: { start: '13:00', end: '17:00', enabled: true },
          tuesday: { start: '', end: '', enabled: false },
          thursday: { start: '', end: '', enabled: false },
          saturday: { start: '', end: '', enabled: false },
          sunday: { start: '', end: '', enabled: false }
        }
      },
      pediatrician: {
        name: 'Dr. Shara Laine S. Vino',
        hours: {
          monday: { start: '13:00', end: '17:00', enabled: true },
          tuesday: { start: '13:00', end: '17:00', enabled: true },
          thursday: { start: '08:00', end: '12:00', enabled: true },
          wednesday: { start: '', end: '', enabled: false },
          friday: { start: '', end: '', enabled: false },
          saturday: { start: '', end: '', enabled: false },
          sunday: { start: '', end: '', enabled: false }
        }
      }
    });
    await settings.save();
  } else if (settings.bookingEnabled === undefined) {
    settings.bookingEnabled = true;
    await settings.save();
  }
  return settings;
};

settingsSchema.statics.updateSettings = async function(newSettings) {
  let settings = await this.findOne();
  if (!settings) {
    settings = new this(newSettings);
  } else {
    Object.assign(settings, newSettings);
  }
  await settings.save();
  return settings;
};

export default mongoose.model('Settings', settingsSchema);



