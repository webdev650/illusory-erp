import { verifyToken } from '../utils/jwt.js';
import { User } from '../models/User.js';
import { sendError } from '../utils/apiResponse.js';

export const requireAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    // Also support Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 'Authentication required. Please log in.', 401);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      return sendError(res, 'Session expired or invalid. Please log in again.', 401);
    }

    const user = await User.findById(decoded.id)
      .populate('role')
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation employment.department');

    if (!user) {
      return sendError(res, 'User no longer exists.', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Account has been deactivated. Please contact an administrator.', 403);
    }

    // Attach to request
    req.user = user;
    req.userRole = user.role?.key || 'employee';
    req.permissions = user.role?.permissions || [];

    next();
  } catch (error) {
    next(error);
  }
};
