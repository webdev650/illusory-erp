import mongoose from 'mongoose';

const warningSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['warning', 'pip'],
      default: 'warning',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Performance Notice',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'closed'],
      default: 'active',
      index: true,
    },
    improvementPlan: {
      type: String,
      default: '',
    },
    endDate: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

export const Warning = mongoose.model('Warning', warningSchema);
