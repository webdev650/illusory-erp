import { z } from 'zod';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import {
  signToken,
  setAuthCookies,
  clearAuthCookies,
  signReauthToken,
  setReauthCookie,
} from '../utils/jwt.js';
import {
  createSession,
  rotateSession,
  revokeSession,
  revokeAllUserSessions,
  listUserSessions,
} from '../services/session.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import { sendEmail } from '../services/email.service.js';
import { logger } from '../utils/logger.js';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'New password must be at least 10 characters long')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter (A-Z)')
    .regex(/[a-z]/, 'New password must contain at least one lowercase letter (a-z)')
    .regex(/[0-9]/, 'New password must contain at least one number (0-9)')
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'New password must contain at least one special symbol (!@#$%^&*...)'),
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

    // Create persistent session in MongoDB and dual tokens
    const { session, rawRefreshToken, accessToken, expiresAt } = await createSession({
      user,
      roleKey: user.role?.key,
      req,
    });

    // Set secure, httpOnly, sliding cookies
    setAuthCookies(res, {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshExpiresAt: expiresAt,
    });

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
      changes: { email: user.email, sessionId: session._id },
    });

    return sendSuccess(
      res,
      {
        token: accessToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          employee: user.employee,
          mustChangePassword: Boolean(user.mustChangePassword),
          lastLoginAt: user.lastLoginAt,
        },
      },
      'Login successful'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Silent background refresh token rotation
 */
export const refreshToken = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawRefreshToken) {
      return sendError(res, 'No refresh token provided', 401, 'REFRESH_TOKEN_REQUIRED');
    }

    const { newSession, rawRefreshToken: nextRefreshToken, accessToken, expiresAt, user } =
      await rotateSession({ rawRefreshToken, req });

    setAuthCookies(res, {
      accessToken,
      refreshToken: nextRefreshToken,
      refreshExpiresAt: expiresAt,
    });

    return sendSuccess(
      res,
      {
        token: accessToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          employee: user.employee,
          mustChangePassword: Boolean(user.mustChangePassword),
          lastLoginAt: user.lastLoginAt,
        },
      },
      'Token refreshed successfully'
    );
  } catch (error) {
    clearAuthCookies(res);
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    if (req.sessionId) {
      await revokeSession(req.sessionId, 'user_logout');
    }
    clearAuthCookies(res);
    return sendSuccess(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const logoutAll = async (req, res, next) => {
  try {
    if (req.user?._id) {
      await revokeAllUserSessions(req.user._id, 'user_logout_all');
    }
    clearAuthCookies(res);
    return sendSuccess(res, null, 'Logged out from all devices successfully');
  } catch (error) {
    next(error);
  }
};

export const listSessions = async (req, res, next) => {
  try {
    const sessions = await listUserSessions(req.user._id, req.sessionId);
    return sendSuccess(res, sessions, 'Active sessions retrieved');
  } catch (error) {
    next(error);
  }
};

export const revokeSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findById(id);
    if (!session) {
      return sendError(res, 'Session not found', 404);
    }

    // Permission check: own session vs other user's session
    const isOwn = session.user.toString() === req.user._id.toString();
    const canRevokeOthers =
      req.permissions?.includes('session.revokeOthers') ||
      req.permissions?.includes('*') ||
      req.userRole === 'super_admin' ||
      req.userRole === 'hr';

    if (!isOwn && !canRevokeOthers) {
      return sendError(res, 'You do not have permission to revoke this session', 403);
    }

    await revokeSession(id, isOwn ? 'user_revoked' : `revoked_by_${req.user._id}`);

    await logAudit({
      req,
      action: 'SESSION_REVOKED',
      entity: 'Session',
      entityId: id,
      changes: { targetUser: session.user, isOwn },
    });

    return sendSuccess(res, null, 'Session revoked successfully');
  } catch (error) {
    next(error);
  }
};

export const reAuthenticate = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return sendError(res, 'Password is required to re-authenticate', 400);
    }

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid password. Please enter your correct current password.', 401);
    }

    // Generate 10-minute re-authentication token
    const reauthToken = signReauthToken({ id: user._id, email: user.email });
    setReauthCookie(res, reauthToken);

    // Also update session reauthExpiresAt if active session
    if (req.sessionId) {
      await Session.findByIdAndUpdate(req.sessionId, {
        reauthExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
    }

    return sendSuccess(
      res,
      {
        reauthToken,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
      'Password confirmed. Sensitive actions unlocked for 10 minutes.'
    );
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
      mustChangePassword: Boolean(user.mustChangePassword),
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user._id)
      .select('+passwordHash +passwordHistory')
      .populate('employee', 'personal.firstName personal.lastName');

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Verify current temporary/active password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 'Current password does not match. Please verify your temporary password.', 400);
    }

    // Rule: Cannot equal temporary password
    if (currentPassword === newPassword) {
      return sendError(res, 'New password cannot be the same as your current temporary password.', 400);
    }

    // Rule: Cannot equal email
    const emailPrefix = user.email.split('@')[0].toLowerCase();
    if (newPassword.toLowerCase() === user.email.toLowerCase() || newPassword.toLowerCase() === emailPrefix) {
      return sendError(res, 'New password cannot be equal to your email address.', 400);
    }

    // Rule: Cannot equal any of the last 5 passwords
    const inHistory = await user.checkPasswordHistory(newPassword);
    if (inHistory) {
      return sendError(res, 'You cannot reuse any of your last 5 passwords. Please choose a new password.', 400);
    }

    // Push current hash into passwordHistory (retaining max 5)
    user.passwordHistory = user.passwordHistory || [];
    user.passwordHistory.push({
      passwordHash: user.passwordHash,
      changedAt: new Date(),
    });
    if (user.passwordHistory.length > 5) {
      user.passwordHistory = user.passwordHistory.slice(-5);
    }

    // Set new password
    user.passwordHash = await User.hashPassword(newPassword);
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
    await user.save();

    // Revoke all other sessions for this user
    await revokeAllUserSessions(user._id, 'password_change');

    // Create a fresh new session for this device
    const { session, rawRefreshToken, accessToken, expiresAt } = await createSession({
      user,
      roleKey: user.role?.key,
      req,
    });

    setAuthCookies(res, {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshExpiresAt: expiresAt,
    });

    // Send essential "account was changed" email (bypasses automationEnabled safety switch)
    const empName = user.employee?.personal?.firstName || 'Team Member';
    const changedTimeIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    sendEmail({
      to: user.email,
      subject: 'Security Alert: Your Illusory ERP Password Was Changed',
      html: `
        <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #6d28d9; margin-top: 0;">Password Successfully Updated</h2>
          <p>Hello ${empName},</p>
          <p>Your password for Illusory ERP was successfully changed on <strong>${changedTimeIST} (IST)</strong>.</p>
          <p>For your security, all other active sessions and logged-in devices have been signed out.</p>
          <p style="margin-top: 24px; font-size: 12px; color: #64748b;">If you did not perform this action, please alert studio HR and IT immediately.</p>
        </div>
      `,
      type: 'account_changed',
      isEssential: true,
    }).catch((err) => {
      logger.warn({ err: err.message }, 'Failed to send account_changed email');
    });

    await logAudit({
      req: { ...req, user },
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: user._id,
      changes: { email: user.email, passwordChangedAt: user.passwordChangedAt },
    });

    return sendSuccess(
      res,
      {
        token: accessToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          employee: user.employee,
          mustChangePassword: false,
          passwordChangedAt: user.passwordChangedAt,
        },
      },
      'Password updated successfully. All other sessions have been logged out.'
    );
  } catch (error) {
    next(error);
  }
};

