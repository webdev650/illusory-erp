import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      required: true,
      index: true,
    },
    policyYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicyYear',
      default: null,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    // Integer minutes storage (primary source of truth)
    openingMinutes: {
      type: Number,
      default: 0,
    },
    entitlementMinutes: {
      type: Number,
      default: 0,
    },
    carriedInMinutes: {
      type: Number,
      default: 0,
    },
    takenMinutes: {
      type: Number,
      default: 0,
    },
    pendingMinutes: {
      type: Number,
      default: 0,
    },
    closingMinutes: {
      type: Number,
      default: 0,
    },
    forwardType: {
      type: String,
      enum: ['lapsed', 'carry_forward', 'encash'],
      default: 'lapsed',
    },
    settlementMinutes: {
      type: Number,
      default: 0,
    },
    encashedMinutes: {
      type: Number,
      default: 0,
    },
    lapsedMinutes: {
      type: Number,
      default: 0,
    },
    carriedForwardMinutes: {
      type: Number,
      default: 0,
    },
    isSettled: {
      type: Boolean,
      default: false,
    },
    settledAt: {
      type: Date,
      default: null,
    },
    isFinalised: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDirty: {
      type: Boolean,
      default: false,
    },
    overrideReason: {
      type: String,
      default: '',
    },
    isOpeningImported: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Legacy day counters (maintained for backward compatibility)
    allocated: {
      type: Number,
      default: 0,
    },
    carried: {
      type: Number,
      default: 0,
    },
    used: {
      type: Number,
      default: 0,
    },
    pending: {
      type: Number,
      default: 0,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ employee: 1, leaveType: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);
export default LeaveBalance;

