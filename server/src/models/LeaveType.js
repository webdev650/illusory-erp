import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    yearlyQuota: { type: Number, required: true, default: 0 }, // In days
    yearlyQuotaMinutes: { type: Number, default: 0 }, // In minutes (e.g. 12 * 465 = 5580)
    carryForward: { type: Boolean, default: false },
    maxCarry: { type: Number, default: 0 }, // In days
    maxCarryMinutes: { type: Number, default: 0 }, // In minutes
    forwardPercent: { type: Number, default: 100 }, // % allowed to carry forward
    encashable: { type: Boolean, default: false },
    paid: { type: Boolean, default: true },
    requiresDocument: { type: Boolean, default: false },
    allowHalfDay: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    accrualMode: {
      type: String,
      enum: ['monthly', 'upfront'],
      default: 'monthly',
    },
    isRuleBookStandard: {
      type: Boolean,
      default: true,
    },
    unverifiedNote: {
      type: String,
      default: '',
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const LeaveType = mongoose.model('LeaveType', leaveTypeSchema);
export default LeaveType;

