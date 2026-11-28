import crypto from 'crypto';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../utils/jwt.js';

export const getSessionDurationDays = (roleKey) => {
  // Super Admin and HR default to 7 days, others default to 30 days
  if (roleKey === 'super_admin' || roleKey === 'hr') {
    return 7;
  }
  return 30;
};

export const parseDeviceLabel = (userAgent = '') => {
  if (!userAgent) return 'Desktop Browser';
  let browser = 'Browser';
  let os = 'Unknown OS';

  if (/edg/i.test(userAgent)) browser = 'Edge';
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/opera|opr/i.test(userAgent)) browser = 'Opera';

  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS';
  else if (/iphone/i.test(userAgent)) os = 'iPhone';
  else if (/ipad/i.test(userAgent)) os = 'iPad';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/linux/i.test(userAgent)) os = 'Linux';

  return `${browser} on ${os}`;
};

export const getClientIp = (req) => {
  return (
    req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    '127.0.0.1'
  );
};

/**
 * Creates a brand-new persistent session for a user on login.
 */
export const createSession = async ({ user, roleKey, req }) => {
  const days = getSessionDurationDays(roleKey || user.role?.key);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const familyId = crypto.randomUUID();
  const { rawToken, tokenHash } = generateRefreshToken();

  const userAgent = req?.headers ? req.headers['user-agent'] || '' : '';
  const deviceLabel = parseDeviceLabel(userAgent);
  const ip = req ? getClientIp(req) : '127.0.0.1';

  const session = await Session.create({
    user: user._id,
    refreshTokenHash: tokenHash,
    familyId,
    deviceLabel,
    ip,
    userAgent,
    lastUsedAt: new Date(),
    expiresAt,
  });

  const accessToken = signAccessToken({
    id: user._id,
    role: roleKey || user.role?.key,
    sessionId: session._id,
    mustChangePassword: Boolean(user.mustChangePassword),
  });

  return {
    session,
    rawRefreshToken: rawToken,
    accessToken,
    expiresAt,
  };
};

/**
 * Rotates a refresh token on silent background refresh.
 * Detects token reuse: if an old/revoked token is presented, revokes all sessions in that family.
 */
export const rotateSession = async ({ rawRefreshToken, req }) => {
  if (!rawRefreshToken) {
    const err = new Error('Refresh token is required');
    err.statusCode = 401;
    err.code = 'REFRESH_TOKEN_REQUIRED';
    throw err;
  }

  const tokenHash = hashToken(rawRefreshToken);
  const session = await Session.findOne({ refreshTokenHash: tokenHash }).populate({
    path: 'user',
    populate: [{ path: 'role' }, { path: 'employee' }],
  });

  if (!session) {
    const err = new Error('Invalid or revoked session');
    err.statusCode = 401;
    err.code = 'INVALID_SESSION';
    throw err;
  }

  // Token Reuse Detection: if this session was already revoked or rotated, an attacker or compromised client is reusing it
  if (session.revokedAt) {
    // Revoke the ENTIRE session family immediately!
    await Session.updateMany(
      { familyId: session.familyId, revokedAt: null },
      {
        revokedAt: new Date(),
        revokedReason: 'family_revoked_reuse_detected',
      }
    );

    const err = new Error('Session reuse detected. All sessions in this chain have been terminated for security. Please sign in again.');
    err.statusCode = 401;
    err.code = 'SESSION_REUSE_DETECTED';
    throw err;
  }

  // Check expiration
  if (new Date() > new Date(session.expiresAt)) {
    session.revokedAt = new Date();
    session.revokedReason = 'expired';
    await session.save();

    const err = new Error('Session has expired. Please sign in again.');
    err.statusCode = 401;
    err.code = 'SESSION_EXPIRED';
    throw err;
  }

  const user = session.user;
  if (!user || !user.isActive) {
    session.revokedAt = new Date();
    session.revokedReason = 'user_inactive';
    await session.save();

    const err = new Error('User account is inactive or disabled');
    err.statusCode = 403;
    err.code = 'ACCOUNT_DISABLED';
    throw err;
  }

  // Generate new rotated token and sliding expiration
  const roleKey = user.role?.key;
  const days = getSessionDurationDays(roleKey);
  const slidingExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const { rawToken: newRawToken, tokenHash: newTokenHash } = generateRefreshToken();

  const userAgent = req?.headers ? req.headers['user-agent'] || '' : session.userAgent;
  const deviceLabel = parseDeviceLabel(userAgent);
  const ip = req ? getClientIp(req) : session.ip;

  // Create the replacement session
  const replacementSession = await Session.create({
    user: user._id,
    refreshTokenHash: newTokenHash,
    familyId: session.familyId,
    deviceLabel,
    ip,
    userAgent,
    lastUsedAt: new Date(),
    expiresAt: slidingExpiresAt,
  });

  // Mark old session as rotated
  session.revokedAt = new Date();
  session.revokedReason = 'rotated';
  session.replacedBy = replacementSession._id;
  await session.save();

  // Issue new short-lived access token
  const newAccessToken = signAccessToken({
    id: user._id,
    role: roleKey,
    sessionId: replacementSession._id,
    mustChangePassword: Boolean(user.mustChangePassword),
  });

  return {
    newSession: replacementSession,
    rawRefreshToken: newRawToken,
    accessToken: newAccessToken,
    expiresAt: slidingExpiresAt,
    user,
  };
};

/**
 * Revokes a single session by ID.
 */
export const revokeSession = async (sessionId, reason = 'user_revoked') => {
  return Session.findByIdAndUpdate(
    sessionId,
    {
      revokedAt: new Date(),
      revokedReason: reason,
    },
    { new: true }
  );
};

/**
 * Revokes all sessions belonging to a specific user (e.g. password change, logout-all, role change).
 */
export const revokeAllUserSessions = async (userId, reason = 'all_sessions_revoked') => {
  return Session.updateMany(
    { user: userId, revokedAt: null },
    {
      revokedAt: new Date(),
      revokedReason: reason,
    }
  );
};

/**
 * Returns active sessions for a user with formatting for "My Sessions" UI.
 */
export const listUserSessions = async (userId, currentSessionId = null) => {
  const sessions = await Session.find({
    user: userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastUsedAt: -1 })
    .lean();

  return sessions.map((s) => ({
    id: s._id,
    deviceLabel: s.deviceLabel,
    ip: s.ip,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    expiresAt: s.expiresAt,
    isCurrent: currentSessionId ? s._id.toString() === currentSessionId.toString() : false,
  }));
};
