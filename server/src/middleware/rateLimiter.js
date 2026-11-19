import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter for standard authenticated or browsing endpoints.
 * 300 requests per 15 minutes window.
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Strict rate limiter for authentication routes to prevent brute-force attacks.
 * 15 attempts per 15 minutes window.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Public endpoint rate limiter for public forms (leads, careers).
 * 30 submissions per 15 minutes window.
 */
export const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Submission limit reached. Please try again later.',
  },
});
