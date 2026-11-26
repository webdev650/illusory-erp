import mongoose from 'mongoose';

const keyResultSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    metric: { type: String, default: '' },
    startValue: { type: Number, default: 0 },
    targetValue: { type: Number, required: true },
    currentValue: { type: Number, default: 0 },
    unit: { type: String, default: '%' },
    weight: { type: Number, default: 1 }, // weight among key results
  },
  { _id: true }
);

const progressUpdateSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    value: { type: Number, required: true },
    note: { type: String, default: '' },
    attachments: [{ type: String }],
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const goalCommentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const goalSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['individual', 'team', 'company'],
      default: 'individual',
      index: true,
    },
    parentGoal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Goal',
      default: null,
    },
    keyResults: [keyResultSchema],
    weight: {
      type: Number,
      default: 1,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'active', 'at_risk', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    visibility: {
      type: String,
      enum: ['private', 'team', 'company'],
      default: 'team',
    },
    linkedProjects: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],
    progressUpdates: [progressUpdateSchema],
    comments: [goalCommentSchema],
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Auto-calculate progress percentage from weighted key results
goalSchema.methods.recalculateProgress = function () {
  if (!this.keyResults || this.keyResults.length === 0) {
    return this.progressPercentage || 0;
  }
  let totalWeight = 0;
  let weightedProgress = 0;

  for (const kr of this.keyResults) {
    const range = (kr.targetValue - kr.startValue) || 1;
    const progress = Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100));
    const w = kr.weight || 1;
    weightedProgress += progress * w;
    totalWeight += w;
  }

  this.progressPercentage = totalWeight > 0 ? Math.round(weightedProgress / totalWeight) : 0;
  if (this.progressPercentage >= 100 && this.status === 'active') {
    this.status = 'completed';
  }
  return this.progressPercentage;
};

export const Goal = mongoose.model('Goal', goalSchema);
export default Goal;
