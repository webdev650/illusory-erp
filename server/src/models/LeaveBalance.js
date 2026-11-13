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
    year: {
      type: Number,
      required: true,
      index: true,
    },
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
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ employee: 1, leaveType: 1, year: 1 }, { unique: true });

export const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);
export default LeaveBalance;

