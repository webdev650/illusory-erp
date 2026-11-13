import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userEmail: {
      type: String,
      default: 'system',
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entity: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;

