import { Router } from 'express';
import { login, logout, getMe, changePassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, changePassword);

export default router;
