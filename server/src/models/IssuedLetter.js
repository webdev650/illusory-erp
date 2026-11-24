import mongoose from 'mongoose';

const letterVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    renderedBody: { type: String, required: true },
    pdfUrl: { type: String, default: '' },
    documentHash: { type: String, default: '' },
    reasonForRegenerating: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const issuedLetterSchema = new mongoose.Schema(
  {
    refNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LetterTemplate',
      required: true,
      index: true,
    },
    templateVersion: {
      type: Number,
      default: 1,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    // Candidate details (if issued for candidate not yet converted to employee)
    candidate: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      designation: { type: String, default: '' },
    },
    extraFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    renderedBody: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'issued', 'revoked', 'expired'],
      default: 'draft',
      index: true,
    },
    currentVersion: {
      type: Number,
      default: 1,
    },
    versions: [letterVersionSchema],
    pdfUrl: {
      type: String,
      default: '',
    },
    documentHash: {
      type: String,
      default: '',
    },
    verificationToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    qrCodeDataUrl: {
      type: String,
      default: '',
    },
    approvalRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
      default: null,
    },
    issuedAt: {
      type: Date,
      default: null,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revocationReason: {
      type: String,
      default: '',
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    eAcknowledge: {
      required: { type: Boolean, default: false },
      accepted: { type: Boolean, default: false },
      acceptedAt: { type: Date, default: null },
      ipAddress: { type: String, default: '' },
      userAgent: { type: String, default: '' },
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

issuedLetterSchema.index({ employee: 1, status: 1, createdAt: -1 });
issuedLetterSchema.index({ category: 1, status: 1, createdAt: -1 });

export const IssuedLetter = mongoose.model('IssuedLetter', issuedLetterSchema);
export default IssuedLetter;
