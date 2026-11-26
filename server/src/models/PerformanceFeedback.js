import mongoose from 'mongoose';

const performanceFeedbackSchema = new mongoose.Schema(
  {
    fromEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    toEmployee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['praise', 'constructive'],
      default: 'praise',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['public', 'private', 'manager_only'],
      default: 'public',
      index: true,
    },
    valueTags: [
      {
        type: String,
        trim: true,
      },
    ],
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isReported: {
      type: Boolean,
      default: false,
    },
    reportReason: {
      type: String,
      default: '',
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const PerformanceFeedback = mongoose.model('PerformanceFeedback', performanceFeedbackSchema);
export default PerformanceFeedback;
