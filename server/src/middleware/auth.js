// src/middleware/auth.js
// protect: verifies the JWT access token from the Authorization header.
// If valid, it attaches the user info to req.user and calls next().
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './error.js';

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  // Expected format: "Bearer <token>"
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Not authenticated. Please log in.', 401));
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    req.user = { id: decoded.id, role: decoded.role }; // Attach to request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Access token expired. Please refresh.', 401));
    }
    return next(new AppError('Invalid token', 401));
  }
};
