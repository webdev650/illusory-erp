import { Router } from 'express';
import { listRoles } from '../controllers/role.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('user.manage'), listRoles);

export default router;
