import mongoose from 'mongoose';

const reviewCycleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['monthly', 'quarterly', 'half_yearly', 'annual', 'probation', 'custom'],
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    participantsScope: {
      type: String,
      enum: ['all', 'department', 'selected', 'probation_ending'],
      default: 'all',
    },
    participantDepartments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
      },
    ],
    participantEmployees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
      },
    ],
    probationDaysLead: {
      type: Number,
      default: 15, // probation reviews created within N days of probation end date
    },
    autoDraftProbation: {
      type: Boolean,
      default: true,
    },
    timeline: {
      goalSettingDeadline: { type: Date, default: null },
      selfReviewDeadline: { type: Date, default: null },
      managerReviewDeadline: { type: Date, default: null },
      calibrationDeadline: { type: Date, default: null },
      publishDate: { type: Date, default: null },
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReviewTemplate',
      required: true,
    },
    templateSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // Preserves snapshot of template so editing template doesn't alter active cycle
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'in_review', 'calibration', 'published', 'closed'],
      default: 'draft',
      index: true,
    },
    enable360: {
      type: Boolean,
      default: false,
    },
    minPeerResponses: {
      type: Number,
      default: 2,
    },
    anonymous360: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

reviewCycleSchema.index({ status: 1, periodStart: 1 });

export const ReviewCycle = mongoose.model('ReviewCycle', reviewCycleSchema);
export default ReviewCycle;
