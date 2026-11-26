import mongoose from 'mongoose';

const leaveLedgerSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
    transactionType: {
      type: String,
      enum: [
        'opening',
        'entitlement',
        'monthly_accrual',
        'taken',
        'pending_hold',
        'pending_release',
        'carried_in',
        'encashed',
        'lapsed',
        'carried_forward',
        'adjustment',
        'override',
        'import',
      ],
      required: true,
      index: true,
    },
    minutes: {
      type: Number,
      required: true, // Positive for credit, negative for debit
    },
    days: {
      type: Number,
      default: 0,
    },
    referenceModel: {
      type: String,
      default: '',
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    memo: {
      type: String,
      default: '',
      index: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

leaveLedgerSchema.index({ employee: 1, leaveType: 1, policyYear: 1, date: -1 });

export const LeaveLedger = mongoose.model('LeaveLedger', leaveLedgerSchema);
export default LeaveLedger;
