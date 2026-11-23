import mongoose from 'mongoose';

const leavePolicyYearSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true, // e.g. "PY-2026"
    },
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Policy Year 2026',
    },
    startDate: {
      type: Date,
      required: true, // Default Jan 1 (editable)
    },
    endDate: {
      type: Date,
      required: true, // Default Dec 31 (editable)
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'finalised'],
      default: 'open',
      index: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
      index: true,
    },
    hoursPerDay: {
      type: Number,
      default: 7.75, // 7.75 hours = 465 minutes
    },
    minutesPerDay: {
      type: Number,
      default: 465, // Standard shift working minutes
    },
    proRataCalculation: {
      type: String,
      enum: ['months', 'days'],
      default: 'months',
    },
    proRataJoiners: {
      type: Boolean,
      default: true,
    },
    proRataLeavers: {
      type: Boolean,
      default: true,
    },
    finalisedAt: {
      type: Date,
      default: null,
    },
    finalisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenReason: {
      type: String,
      default: '',
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

leavePolicyYearSchema.index({ status: 1, isCurrent: 1 });

export const LeavePolicyYear = mongoose.model('LeavePolicyYear', leavePolicyYearSchema);
export default LeavePolicyYear;
