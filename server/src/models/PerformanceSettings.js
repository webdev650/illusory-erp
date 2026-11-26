import mongoose from 'mongoose';

const performanceSettingsSchema = new mongoose.Schema(
  {
    ratingScaleLabels: [
      {
        score: { type: Number, required: true },
        label: { type: String, required: true },
        description: { type: String, default: '' },
      },
    ],
    defaultWeightings: {
      goals: { type: Number, default: 40 },
      competencies: { type: Number, default: 30 },
      values: { type: Number, default: 30 },
    },
    calibrationEnabled: {
      type: Boolean,
      default: true,
    },
    enable360ByDefault: {
      type: Boolean,
      default: false,
    },
    anonymity360: {
      type: Boolean,
      default: true,
    },
    minResponses360: {
      type: Number,
      default: 2,
    },
    minGroupSizeForCharts: {
      type: Number,
      default: 3, // Protect privacy: hide groups < 3 people
    },
    goalApprovalRequired: {
      type: Boolean,
      default: true,
    },
    probationReviewLeadDays: {
      type: Number,
      default: 15,
    },
    resultsVisibility: {
      type: String,
      enum: ['after_publish_only', 'immediate'],
      default: 'after_publish_only',
    },
    retentionYears: {
      type: Number,
      default: 3, // Default 3 years after exit
    },
    noticeText: {
      type: String,
      default: "Review rating scales, weightings and consequences must follow the company's HR policy; confirm with HR.",
    },
    policyConfirmed: {
      type: Boolean,
      default: false,
    },
    policyConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    policyConfirmedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const PerformanceSettings = mongoose.model('PerformanceSettings', performanceSettingsSchema);
export default PerformanceSettings;
