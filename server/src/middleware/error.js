// src/middleware/error.js
// Central error handler — catches everything thrown with next(err).
// In production we hide stack traces from the client.
import { env } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[ERROR] ${req.method} ${req.url} → ${statusCode}: ${message}`);
  if (env.nodeEnv === 'development') console.error(err.stack);

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
  });
};

// A helper to create errors with a status code
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}
