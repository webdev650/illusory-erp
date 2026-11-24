import mongoose from 'mongoose';

const delegationSchema = new mongoose.Schema(
  {
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    delegate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      default: '',
    },
    types: {
      type: [String],
      default: ['all'], // 'all' or specific types: ['leave', 'timesheet', etc.]
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

delegationSchema.index({ approver: 1, isActive: 1, fromDate: 1, toDate: 1 });

export const Delegation = mongoose.model('Delegation', delegationSchema);
export default Delegation;
