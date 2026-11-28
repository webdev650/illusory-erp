import mongoose from 'mongoose';

const lateReasonOptionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
    },
    requiresNote: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const DEFAULT_LATE_REASONS = [
  { key: 'transport_issue', label: 'Transport issue', emoji: '🚌', requiresNote: false, order: 1 },
  { key: 'health_issue', label: 'Health issue', emoji: '🤒', requiresNote: false, order: 2 },
  { key: 'family_emergency', label: 'Family emergency', emoji: '👨‍👩‍👧', requiresNote: false, order: 3 },
  { key: 'weather', label: 'Weather', emoji: '🌧️', requiresNote: false, order: 4 },
  { key: 'power_internet', label: 'Internet or power problem', emoji: '📶', requiresNote: false, order: 5 },
  { key: 'personal_commitment', label: 'Personal commitment', emoji: '🗓️', requiresNote: false, order: 6 },
  { key: 'client_visit', label: 'Client or work-related visit', emoji: '🏢', requiresNote: false, order: 7 },
  { key: 'other', label: 'Other', emoji: '📝', requiresNote: true, order: 8 },
];

export const LateReasonOption = mongoose.model('LateReasonOption', lateReasonOptionSchema);
export default LateReasonOption;
