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
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
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

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Sign JWT
    const token = signToken({ id: user._id, role: user.role?.key });
    setTokenCookie(res, token);

    // Update lastLoginAt
    user.lastLoginAt = new Date();
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

