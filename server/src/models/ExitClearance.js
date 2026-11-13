import mongoose from 'mongoose';

const exitClearanceItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: ['asset', 'license'],
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    tagOrKey: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'returned', 'lost', 'revoked'],
      default: 'pending',
    },
    conditionAtReturn: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor'],
    },
    note: {
      type: String,
      default: '',
    },
    resolvedAt: {
      type: Date,
    },
  },
  { _id: true }
);

const exitClearanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'cleared'],
      default: 'pending',
      index: true,
    },
    initiatedAt: {
      type: Date,
      default: Date.now,
    },
    clearedAt: {
      type: Date,
    },
    clearedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    checklist: [exitClearanceItemSchema],
  },
  {
    timestamps: true,
  }
);

export const ExitClearance = mongoose.model('ExitClearance', exitClearanceSchema);
export default ExitClearance;
