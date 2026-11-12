import mongoose from 'mongoose';

const timeEntrySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'project_work',
        'meeting',
        'review',
        'learning',
        'admin',
        'internal',
        'support',
        'other',
      ],
      default: 'project_work',
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 1000,
    },
    startTime: {
      type: Date,
      default: null,
    },
    endTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [5, 'Minimum time entry duration is 5 minutes'],
      max: [960, 'Maximum time entry duration in a single session is 16 hours (960 minutes)'],
    },
    isBillable: {
      type: Boolean,
      default: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['manual', 'timer'],
      default: 'manual',
    },
    timesheet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Timesheet',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

timeEntrySchema.index({ employee: 1, date: 1 });
timeEntrySchema.index({ employee: 1, status: 1 });
timeEntrySchema.index({ project: 1, date: 1 });

export default mongoose.model('TimeEntry', timeEntrySchema);
