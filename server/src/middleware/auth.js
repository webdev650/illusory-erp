import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { sendError } from '../utils/apiResponse.js';

export const requireAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.accessToken || req.cookies?.token;

    // Also support Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 'Authentication required. Please log in.', 401, 'AUTH_REQUIRED');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return sendError(res, 'Session expired or invalid. Please log in again.', 401, 'TOKEN_EXPIRED');
    }

    const user = await User.findById(decoded.id)
      .populate('role')
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation employment.department employment.attendanceTracked');

    if (!user) {
      return sendError(res, 'User no longer exists.', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return sendError(res, 'Account has been deactivated. Please contact an administrator.', 403, 'ACCOUNT_DEACTIVATED');
    }

    // Check temporary password expiry (7 days)
    if (user.mustChangePassword && user.tempPasswordExpiresAt && new Date() > new Date(user.tempPasswordExpiresAt)) {
      return sendError(
        res,
        'Your temporary password has expired (7-day validity). Please contact HR to reset your password.',
        403,
        'TEMP_PASSWORD_EXPIRED'
      );
    }

    // Enforce server-side mandatory password change: block all other endpoints
    if (user.mustChangePassword) {
      const allowedPaths = [
        '/api/v1/auth/change-password',
        '/api/v1/auth/me',
        '/api/v1/auth/logout',
        '/api/v1/health',
        '/api/v1/ready',
      ];
      const requestPath = req.baseUrl ? `${req.baseUrl}${req.path}` : req.originalUrl.split('?')[0];
      const isAllowed = allowedPaths.some((p) => requestPath === p || requestPath.endsWith(p));

      if (!isAllowed) {
        return sendError(
          res,
          'You must set a new permanent password before proceeding.',
          403,
          'PASSWORD_CHANGE_REQUIRED'
        );
      }
    }

    // Attach to request
    req.user = user;
    req.userRole = user.role?.key || 'employee';
    req.permissions = user.role?.permissions || [];
    req.sessionId = decoded.sessionId || null;

    next();
  } catch (error) {
    next(error);
  }
};
