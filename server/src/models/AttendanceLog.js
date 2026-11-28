import mongoose from 'mongoose';

const attendanceLogSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD in IST
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['in', 'out', 'break_in', 'break_out'],
      required: true,
      index: true,
    },
    time: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['web', 'manual', 'bulk', 'regularized'],
      default: 'web',
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    lateReasonKey: {
      type: String,
      default: null,
      index: true,
    },
    lateReasonLabel: {
      type: String,
      default: null,
    },
    lateNote: {
      type: String,
      default: null,
    },
    ip: {
      type: String,
      default: '',
    },
    device: {
      type: String,
      default: '',
    },
    retainedUntil: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Retained 90 days
    },
    note: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: 'Studio (Bhubaneswar)',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bulkActionId: {
      type: String,
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    deviceInfo: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

attendanceLogSchema.index({ employee: 1, date: 1, isDeleted: 1 });

export const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);
export default AttendanceLog;
