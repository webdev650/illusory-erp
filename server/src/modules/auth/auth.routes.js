// src/modules/auth/auth.routes.js
// Defines all /api/auth/* endpoints and connects them to controllers.
import { Router } from 'express';
import { register, login, refresh, logout, getMe } from './auth.controller.js';
import { protect } from '../../middleware/auth.js';

const router = Router();

router.post('/register', register);   // POST /api/auth/register
router.post('/login', login);         // POST /api/auth/login
router.post('/refresh', refresh);     // POST /api/auth/refresh  (uses cookie)
router.post('/logout', logout);       // POST /api/auth/logout
router.get('/me', protect, getMe);   // GET  /api/auth/me  (requires login)

export default router;
