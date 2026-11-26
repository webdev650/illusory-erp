import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
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
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    isHalfDay: {
      type: Boolean,
      default: false,
    },
    days: {
      type: Number,
      required: true,
    },
    minutes: {
      type: Number,
      default: 465,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    document: {
      url: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'unauthorized'],
      default: 'pending',
      index: true,
    },
    isEmergency: {
      type: Boolean,
      default: false,
    },
    isUnauthorized: {
      type: Boolean,
      default: false,
      index: true,
    },
    isException: {
      type: Boolean,
      default: false,
    },
    proofStatus: {
      type: String,
      enum: ['none', 'proof_pending', 'submitted', 'verified'],
      default: 'none',
    },
    proofDeadline: {
      type: Date,
      default: null,
    },
    unauthorizedReason: {
      type: String,
      default: '',
    },
    hrAction: {
      type: String,
      enum: ['none', 'converted_to_approved', 'converted_to_lwp', 'kept_unauthorized'],
      default: 'none',
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
    },
    appliedBy: {
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

leaveRequestSchema.index({ employee: 1, fromDate: 1, toDate: 1 });

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
export default LeaveRequest;

