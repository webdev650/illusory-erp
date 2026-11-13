import mongoose from 'mongoose';

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    yearlyQuota: { type: Number, required: true, default: 0 },
    carryForward: { type: Boolean, default: false },
    maxCarry: { type: Number, default: 0 },
    paid: { type: Boolean, default: true },
    requiresDocument: { type: Boolean, default: false },
    allowHalfDay: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LeaveType = mongoose.model('LeaveType', leaveTypeSchema);
export default LeaveType;

