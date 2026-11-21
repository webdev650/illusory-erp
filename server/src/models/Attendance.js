import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    workHours: {
      type: Number,
      default: 0,
    },
    breaks: [
      {
        start: {
          type: Date,
          required: true,
        },
        end: {
          type: Date,
          default: null,
        },
        reason: {
          type: String,
          default: 'Break',
        },
      },
    ],
    status: {
      type: String,
      enum: ['present', 'absent', 'half_day', 'late', 'leave', 'holiday', 'weekend', 'wfh'],
      default: 'absent',
      index: true,
    },
    lateReason: {
      type: String,
      enum: ['Transport issue', 'Personal commitment', 'Health', 'Weather', 'Other', ''],
      default: '',
    },
    lateMinutes: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ['web', 'manual'],
      default: 'web',
    },
    note: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: 'Studio (Bhubaneswar)',
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Unique compound index: one attendance entry per employee per date
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;

