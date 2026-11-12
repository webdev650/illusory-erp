import { AuditLog } from '../models/AuditLog.js';

export const logAudit = async ({ req, action, entity, entityId, changes = {} }) => {
  try {
    await AuditLog.create({
      user: req.user?._id || null,
      userEmail: req.user?.email || 'system',
      action,
      entity,
      entityId,
      changes,
      ip: req.ip || req.connection?.remoteAddress || '',
    });
  } catch (err) {
    console.warn(`[AuditLog Warning] Could not record audit log: ${err.message}`);
  }
};
