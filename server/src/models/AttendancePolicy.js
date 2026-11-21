import mongoose from 'mongoose';

const attendancePolicySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'Default Studio Policy',
    },
    graceMinutes: {
      type: Number,
      default: 15, // Up to 10:15 AM
    },
    lateAfter: {
      type: Number,
      default: 15, // Minutes past shift start
    },
    halfDayMinMinutes: {
      type: Number,
      default: 240, // 4 hours
    },
    fullDayMinMinutes: {
      type: Number,
      default: 465, // 7.75 hours (10:00 - 18:45 with 1h break)
    },
    autoCloseMissingClockOutAt: {
      type: String,
      default: '19:00', // IST
    },
    maxBackdateDays: {
      type: Number,
      default: 15,
    },
    weekOffDays: {
      type: [Number],
      default: [0], // 0 = Sunday
    },
    breakMinutes: {
      type: Number,
      default: 60,
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const AttendancePolicy = mongoose.model('AttendancePolicy', attendancePolicySchema);
export default AttendancePolicy;
