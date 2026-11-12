import mongoose from 'mongoose';

const approvalStepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, default: '' },
    approverRole: { type: String, default: '' }, // e.g. 'hr', 'super_admin'
    approverEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'skipped'],
      default: 'pending',
    },
    actedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actedAt: {
      type: Date,
      default: null,
    },
    comment: {
      type: String,
      default: '',
    },
  },
  { _id: true }
);

const approvalRequestSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['leave', 'expense', 'travel', 'asset', 'regularization', 'other'],
      index: true,
    },
    referenceModel: {
      type: String,
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    steps: [approvalStepSchema],
    currentStep: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

approvalRequestSchema.index({ status: 1, 'steps.approverEmployee': 1 });
approvalRequestSchema.index({ status: 1, 'steps.approverRole': 1 });

export const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema);

