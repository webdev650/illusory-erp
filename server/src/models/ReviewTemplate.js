import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true },
    type: { type: String, enum: ['rating', 'text', 'boolean'], default: 'rating' },
    required: { type: Boolean, default: true },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // e.g., 'goals', 'competencies', 'values', 'feedback', 'overall'
    title: { type: String, required: true },
    weight: { type: Number, default: 20 }, // Percentage weight (e.g. 40% goals, 30% competencies, 30% values)
    description: { type: String, default: '' },
    questions: [questionSchema],
    completedBy: [{ type: String, enum: ['employee', 'manager', 'peers', 'hr'], default: ['employee', 'manager'] }],
    visibility: [{ type: String, enum: ['employee', 'manager', 'hr', 'super_admin'], default: ['employee', 'manager', 'hr', 'super_admin'] }],
  },
  { _id: false }
);

const reviewTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['annual', 'probation', 'quarterly', 'half_yearly', 'custom'],
      default: 'annual',
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    isSample: {
      type: Boolean,
      default: false,
    },
    unverified: {
      type: Boolean,
      default: true, // "unverified, confirm with HR"
    },
    ratingScale: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 5 },
      requireCommentOnExtreme: { type: Boolean, default: true }, // Comment required for score 1 or 5
      labels: [
        {
          score: { type: Number, required: true },
          label: { type: String, required: true },
          description: { type: String, default: '' },
        },
      ],
    },
    sections: [sectionSchema],
    weightings: {
      type: mongoose.Schema.Types.Mixed,
      default: { goals: 40, competencies: 30, values: 30 },
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'active',
      index: true,
    },
    createdBy: {
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

export const ReviewTemplate = mongoose.model('ReviewTemplate', reviewTemplateSchema);
export default ReviewTemplate;
