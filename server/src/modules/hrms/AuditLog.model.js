// src/modules/hrms/AuditLog.model.js
// Records who changed what employee record and when.
// NEVER delete audit logs — they are your compliance trail.
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorRole: { type: String },
    action: { type: String, required: true }, // e.g. "UPDATE_EMPLOYEE", "CREATE_EMPLOYEE"
    targetModel: { type: String, default: 'Employee' },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    changes: { type: mongoose.Schema.Types.Mixed }, // The changed fields (sanitised)
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
