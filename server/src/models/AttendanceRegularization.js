import mongoose from 'mongoose';

const regularizationSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    requestedCheckIn: {
      type: Date,
      default: null,
    },
    requestedCheckOut: {
      type: Date,
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
    },
  },
  { timestamps: true }
);

export const AttendanceRegularization = mongoose.model(
  'AttendanceRegularization',
  regularizationSchema
);
