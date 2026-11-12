// src/modules/auth/auth.service.js
// Business logic for authentication.
// Controllers call these functions; they don't know about req/res.
import jwt from 'jsonwebtoken';
import { User, ROLES } from './User.model.js';
import { AppError } from '../../middleware/error.js';
import { env } from '../../config/env.js';

/** Generate a short-lived access token (15 min) */
export const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  });
};

/** Generate a long-lived refresh token (7 days) */
export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  });
};

/** Set the refresh token as an httpOnly cookie (not accessible via JS) */
export const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,          // JS cannot read this — prevents XSS theft
    secure: env.nodeEnv === 'production', // HTTPS only in production
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
};

export const registerUser = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new AppError('Email already registered', 409);

  // The very first user ever registered becomes SUPER_ADMIN automatically
  const userCount = await User.countDocuments();
  const role = userCount === 0 ? ROLES.SUPER_ADMIN : ROLES.EMPLOYEE;

  const user = await User.create({ name, email, password, role });
  return { id: user._id, name: user.name, email: user.email, role: user.role };
};

export const loginUser = async ({ email, password }, res) => {
  // We need password, so we .select('+password +refreshTokens')
  const user = await User.findOne({ email }).select('+password +refreshTokens');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }
  if (!user.isActive) throw new AppError('Account is deactivated', 403);

  const accessToken = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // Save the refresh token in the DB (supports logout from all devices later)
  user.refreshTokens = [...(user.refreshTokens || []), refreshToken];
  user.lastLogin = new Date();
  await user.save();

  setRefreshCookie(res, refreshToken);

  return {
    accessToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

export const refreshAccessToken = async (token, res) => {
  if (!token) throw new AppError('No refresh token', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwt.refreshSecret);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.refreshTokens?.includes(token)) {
    throw new AppError('Refresh token not recognised', 401);
  }

  // Rotate: remove old token, issue new ones
  user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
  const newRefreshToken = generateRefreshToken(user._id);
  user.refreshTokens.push(newRefreshToken);
  await user.save();

  const accessToken = generateAccessToken(user._id, user.role);
  setRefreshCookie(res, newRefreshToken);

  return { accessToken };
};

export const logoutUser = async (token, res) => {
  res.clearCookie('refreshToken');
  if (!token) return;

  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret);
    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (user) {
      user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
      await user.save();
    }
  } catch {
    // Token already expired — that's fine, just clear the cookie
  }
};
