import mongoose from 'mongoose';

const timesheetSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    weekStart: {
      type: Date,
      required: [true, 'Week start date (Monday) is required'],
      index: true,
    },
    weekEnd: {
      type: Date,
      required: [true, 'Week end date (Sunday) is required'],
    },
    totalMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    billableMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected', 'reopened'],
      default: 'draft',
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewComment: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

timesheetSchema.index({ employee: 1, weekStart: 1 }, { unique: true });
timesheetSchema.index({ status: 1, weekStart: 1 });

export default mongoose.model('Timesheet', timesheetSchema);

