import mongoose from 'mongoose';

const bulkActionSchema = new mongoose.Schema(
  {
    bulkActionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    actionType: {
      type: String,
      enum: ['in', 'out', 'break_in', 'break_out'],
      required: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },
    punchTime: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    executedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    affectedEmployees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
      },
    ],
    logsCreated: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceLog',
      },
    ],
    summary: {
      requestedCount: { type: Number, default: 0 },
      succeededCount: { type: Number, default: 0 },
      skippedCount: { type: Number, default: 0 },
      failedCount: { type: Number, default: 0 },
    },
    details: [
      {
        employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        employeeName: { type: String, default: '' },
        employeeCode: { type: String, default: '' },
        status: { type: String, enum: ['succeeded', 'skipped', 'failed'] },
        reason: { type: String, default: '' },
        logId: { type: mongoose.Schema.Types.ObjectId, default: null },
      },
    ],
    isUndone: {
      type: Boolean,
      default: false,
      index: true,
    },
    undoneAt: {
      type: Date,
      default: null,
    },
    undoneBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true, // Created + 24 hours (Undo window)
    },
    isDemo: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

bulkActionSchema.index({ createdAt: -1, isUndone: 1 });

export const BulkAction = mongoose.model('BulkAction', bulkActionSchema);
export default BulkAction;
