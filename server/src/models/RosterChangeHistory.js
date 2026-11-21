import mongoose from 'mongoose';

const rosterChangeHistorySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    oldShift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    newShift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    changeType: {
      type: String,
      enum: ['assign', 'update', 'remove'],
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    affectedPastDate: {
      type: Boolean,
      default: false,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

rosterChangeHistorySchema.index({ employee: 1, date: 1, createdAt: -1 });

export const RosterChangeHistory = mongoose.model('RosterChangeHistory', rosterChangeHistorySchema);
export default RosterChangeHistory;
