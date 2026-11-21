import mongoose from 'mongoose';

const compOffCreditSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    compOffRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CompOffRequest',
      default: null,
    },
    earnedDate: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    creditMinutes: {
      type: Number,
      required: true,
      default: 465, // 1 standard studio working day (7h 45m)
    },
    usedMinutes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired'],
      default: 'active',
      index: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

compOffCreditSchema.index({ employee: 1, status: 1, expiresAt: 1 });

export const CompOffCredit = mongoose.model('CompOffCredit', compOffCreditSchema);
export default CompOffCredit;
