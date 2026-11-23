import mongoose from 'mongoose';

const settlementAuditSchema = new mongoose.Schema(
  {
    policyYear: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicyYear',
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    leaveType: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveType',
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: ['draft_save', 'override', 'settle_save', 'finalise', 'reopen', 'import', 'recalculate'],
      required: true,
      index: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

settlementAuditSchema.index({ employee: 1, policyYear: 1, createdAt: -1 });

export const SettlementAudit = mongoose.model('SettlementAudit', settlementAuditSchema);
export default SettlementAudit;
