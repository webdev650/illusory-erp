import { Router } from 'express';
import { getDashboardSummary } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);
router.get('/summary', requirePermission('dashboard.read'), getDashboardSummary);

export default router;

