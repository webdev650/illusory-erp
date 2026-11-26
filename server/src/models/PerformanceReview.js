import mongoose from 'mongoose';

const sectionResponseSchema = new mongoose.Schema(
  {
    sectionKey: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, default: '' },
    evidenceFiles: [{ type: String }],
  },
  { _id: false }
);

const postPublishChangeSchema = new mongoose.Schema(
  {
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    oldRating: { type: Number },
    newRating: { type: Number },
    reason: { type: String, required: true },
  },
  { _id: true }
);

const performanceReviewSchema = new mongoose.Schema(
  {
    cycle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReviewCycle',
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'goals_confirmed',
        'self_review_pending',
        'self_review_submitted',
        'manager_review_submitted',
        'calibration',
        'published',
        'acknowledged',
        'disputed',
        'closed',
      ],
      default: 'self_review_pending',
      index: true,
    },
    // 1. Goals snapshot/confirmation at cycle start
    goalsConfirmed: {
      confirmed: { type: Boolean, default: false },
      confirmedAt: { type: Date, default: null },
    },
    // 2. Self Review
    selfReview: {
      submittedAt: { type: Date, default: null },
      sectionResponses: [sectionResponseSchema],
      overallComment: { type: String, default: '' },
    },
    // 3. Manager Review (Confidential until published)
    managerReview: {
      submittedAt: { type: Date, default: null },
      sectionResponses: [sectionResponseSchema],
      strengths: { type: String, default: '' },
      areasToImprove: { type: String, default: '' },
      developmentPlan: { type: String, default: '' },
      recommendationNotes: { type: String, default: '' }, // Internal HR/Manager notes
      recommendPIP: { type: Boolean, default: false },
      recommendPromotion: { type: Boolean, default: false },
      recommendIncrement: { type: Boolean, default: false },
      recommendedRating: { type: Number, default: 0 }, // Calculated suggestion from section weights
      finalOverallRating: { type: Number, default: 0 }, // Manually entered rating (1-5)
      ratingDiffReason: { type: String, default: '' }, // Mandatory if final differs from suggestion
    },
    // 4. Calibration (HR & Super Admin)
    calibration: {
      calibratedAt: { type: Date, default: null },
      calibratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      previousRating: { type: Number, default: null },
      calibratedRating: { type: Number, default: null },
      calibrationReason: { type: String, default: '' },
    },
    // 5. Publication
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // 6. Employee Acknowledgement ("Received, not agreed")
    employeeAcknowledgement: {
      acknowledgedAt: { type: Date, default: null },
      comments: { type: String, default: '' },
      isDisputed: { type: Boolean, default: false }, // "I disagree" routes to HR
      meetingRequested: { type: Boolean, default: false },
    },
    postPublishRatingChanges: [postPublishChangeSchema],
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

performanceReviewSchema.index({ cycle: 1, employee: 1 }, { unique: true });
performanceReviewSchema.index({ manager: 1, status: 1 });

export const PerformanceReview = mongoose.model('PerformanceReview', performanceReviewSchema);
export default PerformanceReview;
