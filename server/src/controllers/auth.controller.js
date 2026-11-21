import { z } from 'zod';
import { User } from '../models/User.js';
import { signToken, setTokenCookie, clearTokenCookie } from '../utils/jwt.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'New password must be at least 10 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
});

export const login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .populate('role')
      .populate('employee');

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'Account is deactivated. Please contact an admin.', 403);
    }

    // Check account lockout (15 minutes after 5 consecutive failed attempts)
    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / 60000);
      return sendError(
        res,
        `Account is temporarily locked due to consecutive failed attempts. Please try again after ${remainingMinutes} minute(s).`,
        423
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        return sendError(
          res,
          'Account locked for 15 minutes due to 5 consecutive failed login attempts.',
          423
        );
      }
      await user.save();
      const remaining = 5 - user.failedLoginAttempts;
      return sendError(
        res,
        `Invalid email or password. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before 15-minute lockout)`,
        401
      );
    }

    // Sign JWT
    const token = signToken({ id: user._id, role: user.role?.key });
    setTokenCookie(res, token);

    // Reset failed attempts, update lastLoginAt, record loginHistory
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet|ipad/i.test(userAgent)) device = 'Tablet';

    user.loginHistory = user.loginHistory || [];
    user.loginHistory.unshift({
      time: new Date(),
      ip,
      device,
      userAgent: userAgent.slice(0, 200),
    });
    if (user.loginHistory.length > 20) {
      user.loginHistory = user.loginHistory.slice(0, 20);
    }

    await user.save();

    await logAudit({
      req: { ...req, user },
      action: 'USER_LOGIN',
      entity: 'User',
      entityId: user._id,
      changes: { email: user.email },
    });

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          employee: user.employee,
          mustChangePassword: user.mustChangePassword,
          lastLoginAt: user.lastLoginAt,
        },
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    clearTokenCookie(res);
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('role')
      .populate({
        path: 'employee',
        populate: { path: 'employment.department', select: 'name code' },
      });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, {
      id: user._id,
      email: user.email,
      role: user.role,
      employee: user.employee,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 'Current password does not match', 400);
    }

    user.passwordHash = await User.hashPassword(newPassword);
    user.mustChangePassword = false;
    await user.save();

    await logAudit({
      req,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: user._id,
    });

    return sendSuccess(res, null, 'Password updated successfully. Please continue.');
  } catch (error) {
    next(error);
  }
};

