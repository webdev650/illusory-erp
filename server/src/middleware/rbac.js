import { sendError } from '../utils/apiResponse.js';

export const hasPermission = (permissions = [], requiredKey) => {
  if (permissions.includes('*')) return true;
  if (Array.isArray(requiredKey)) {
    return requiredKey.some((k) => permissions.includes(k));
  }
  return permissions.includes(requiredKey);
};

export const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!hasPermission(req.permissions, permissionKey)) {
      return sendError(
        res,
        `Access denied. You lack the required permission: [${permissionKey}]`,
        403
      );
    }

    next();
  };
};

export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(req.userRole)) {
      return sendError(
        res,
        `Access denied. This action is restricted to: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
};

