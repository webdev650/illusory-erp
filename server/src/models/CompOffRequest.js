import mongoose from 'mongoose';

const compOffRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    workedDate: {
      type: Date,
      required: true,
    },
    workedMinutes: {
      type: Number,
      default: 465,
    },
    creditDays: {
      type: Number,
      default: 1,
    },
    creditMinutes: {
      type: Number,
      default: 465,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
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

compOffRequestSchema.index({ employee: 1, workedDate: 1, status: 1 });

export const CompOffRequest = mongoose.model('CompOffRequest', compOffRequestSchema);
export default CompOffRequest;
