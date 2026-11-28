import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  logout,
  logoutAll,
  refreshToken,
  getMe,
  changePassword,
  listSessions,
  revokeSessionById,
  reAuthenticate,
} from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Strict rate limiter for login route: max 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.post('/refresh-token', refreshToken);
router.post('/logout', requireAuth, logout);
router.post('/logout-all', requireAuth, logoutAll);
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, changePassword);
router.post('/re-authenticate', requireAuth, reAuthenticate);
router.get('/sessions', requireAuth, listSessions);
router.delete('/sessions/:id', requireAuth, revokeSessionById);

export default router;
