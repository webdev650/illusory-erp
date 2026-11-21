import mongoose from 'mongoose';

const partialDayRequestSchema = new mongoose.Schema(
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
    },
    type: {
      type: String,
      enum: ['late_coming', 'early_leaving', 'short_leave'],
      required: true,
    },
    minutes: {
      type: Number,
      required: true,
      min: 15,
      max: 240,
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

partialDayRequestSchema.index({ employee: 1, date: 1, status: 1 });

export const PartialDayRequest = mongoose.model('PartialDayRequest', partialDayRequestSchema);
export default PartialDayRequest;
