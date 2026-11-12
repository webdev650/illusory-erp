import mongoose from 'mongoose';

const workflowStepSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    name: { type: String, required: true },
    approverType: {
      type: String,
      enum: ['manager', 'role', 'employee'],
      required: true,
    },
    roleKey: { type: String, default: '' }, // e.g. 'hr', 'finance', 'super_admin'
    specificEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
    },
  },
  { _id: false }
);

const workflowConfigSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      unique: true,
      enum: ['leave', 'expense', 'travel', 'asset', 'regularization', 'other'],
    },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    steps: [workflowStepSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const WorkflowConfig = mongoose.model('WorkflowConfig', workflowConfigSchema);

