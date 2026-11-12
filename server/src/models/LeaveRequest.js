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
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
    },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employee: 1, fromDate: 1, toDate: 1 });

export const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
