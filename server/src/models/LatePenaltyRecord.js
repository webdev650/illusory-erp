import mongoose from 'mongoose';

const latePenaltyRecordSchema = new mongoose.Schema(
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
    dateStr: {
      type: String,
      required: true,
      index: true,
    },
    month: {
      type: Number,
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    checkInTime: {
      type: Date,
      required: true,
    },
    lateMinutes: {
      type: Number,
      required: true,
    },
    entryNumberInMonth: {
      type: Number,
      required: true,
    },
    deductionTier: {
      type: String,
      enum: ['none', 'half_day', 'full_day'],
      default: 'none',
      index: true,
    },
    penaltyMode: {
      type: String,
      enum: ['flag_for_review', 'deduct_from_leave', 'deduct_salary'],
      default: 'flag_for_review',
    },
    status: {
      type: String,
      enum: ['pending_hr_review', 'approved', 'waived', 'modified'],
      default: 'pending_hr_review',
      index: true,
    },
    isExcused: {
      type: Boolean,
      default: false,
      index: true,
    },
    excuseType: {
      type: String,
      enum: ['none', 'regularization', 'partial_day', 'hr_waiver'],
      default: 'none',
    },
    excuseReference: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewReason: {
      type: String,
      default: '',
    },
    auditHistory: [
      {
        action: String,
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedAt: { type: Date, default: Date.now },
        reason: String,
        details: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

latePenaltyRecordSchema.index({ employee: 1, year: 1, month: 1 });
latePenaltyRecordSchema.index({ dateStr: 1, employee: 1 }, { unique: true });

export const LatePenaltyRecord = mongoose.model('LatePenaltyRecord', latePenaltyRecordSchema);
export default LatePenaltyRecord;
