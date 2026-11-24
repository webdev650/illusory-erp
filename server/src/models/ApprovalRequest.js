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
      enum: [
        'leave',
        'expense',
        'travel',
        'asset',
        'asset_request',
        'regularization',
        'timesheet',
        'remote_work',
        'partial_day',
        'comp_off',
        'other',
      ],
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
      enum: ['pending', 'approved', 'rejected', 'cancelled', 'returned'],
      default: 'pending',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    slaHours: {
      type: Number,
      default: 48,
    },
    dueDate: {
      type: Date,
      default: null,
      index: true,
    },
    urgency: {
      type: String,
      enum: ['on_time', 'due_soon', 'overdue'],
      default: 'on_time',
      index: true,
    },
    returnComment: {
      type: String,
      default: '',
    },
    returnedAt: {
      type: Date,
      default: null,
    },
    comments: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: { type: String, default: '' },
        text: { type: String, required: true },
        isInternal: { type: Boolean, default: false }, // approvers-only vs visible to requester
        createdAt: { type: Date, default: Date.now },
      },
    ],
    timeline: [
      {
        action: { type: String, required: true }, // CREATED, APPROVED_STEP, REJECTED, RETURNED, REASSIGNED, DELEGATED, ESCALATED, COMMENTED
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedByName: { type: String, default: '' },
        comment: { type: String, default: '' },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

approvalRequestSchema.index({ status: 1, 'steps.approverEmployee': 1, createdAt: -1 });
approvalRequestSchema.index({ status: 1, 'steps.approverRole': 1, createdAt: -1 });
approvalRequestSchema.index({ requestedBy: 1, status: 1, createdAt: -1 });
approvalRequestSchema.index({ type: 1, status: 1, createdAt: -1 });

export const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema);
export default ApprovalRequest;

