import mongoose from 'mongoose';

const letterTemplateSchema = new mongoose.Schema(
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
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'offer',
        'appointment',
        'confirmation',
        'probation_extension',
        'promotion',
        'increment',
        'transfer',
        'warning',
        'experience',
        'relieving',
        'salary_certificate',
        'address_proof',
        'employment_verification',
        'NOC',
        'internship_certificate',
        'custom',
      ],
      index: true,
    },
    body: {
      type: String,
      required: true, // Rich HTML / Markdown template content
    },
    headerOptions: {
      showLogo: { type: Boolean, default: true },
      showCompanyHeader: { type: Boolean, default: true },
      customHeaderHtml: { type: String, default: '' },
    },
    footerOptions: {
      showPageNumbers: { type: Boolean, default: true },
      showConfidentialityNotice: { type: Boolean, default: true },
      customFooterHtml: { type: String, default: '' },
    },
    pageSize: {
      type: String,
      enum: ['A4', 'Letter'],
      default: 'A4',
    },
    signatory: {
      name: { type: String, default: 'Aparna Tripathy' },
      designation: { type: String, default: 'Managing Director' },
      signatureImageUrl: { type: String, default: '' },
    },
    requiresApproval: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'active',
      index: true,
    },
    isReviewed: {
      type: Boolean,
      default: false, // Sample templates must be reviewed before generating for real employees
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    isSample: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export const LetterTemplate = mongoose.model('LetterTemplate', letterTemplateSchema);
export default LetterTemplate;
