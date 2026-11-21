import mongoose from 'mongoose';

const remoteWorkRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    fromDate: {
      type: Date,
      required: true,
    },
    toDate: {
      type: Date,
      required: true,
    },
    days: {
      type: Number,
      required: true,
      default: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      default: '',
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

remoteWorkRequestSchema.index({ employee: 1, fromDate: 1, toDate: 1 });

export const RemoteWorkRequest = mongoose.model('RemoteWorkRequest', remoteWorkRequestSchema);
export default RemoteWorkRequest;

