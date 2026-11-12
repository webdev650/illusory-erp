// src/middleware/audit.js
// Saves an audit log entry whenever an employee record is changed.
// Use as middleware on routes that mutate employee data.
import { AuditLog } from '../modules/hrms/AuditLog.model.js';

export const auditLog = (action) => async (req, res, next) => {
  // We override res.json to capture the outgoing response
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await AuditLog.create({
          actor: req.user?.id || 'system',
          actorRole: req.user?.role || 'system',
          action,
          targetModel: 'Employee',
          targetId: req.params.id || body?.data?._id,
          changes: req.body,
          ipAddress: req.ip,
        });
      } catch (e) {
        console.warn('Audit log failed:', e.message);
      }
    }
    return originalJson(body);
  };
  next();
};
