import { Router } from 'express';
import {
  listUsers,
  createUser,
  toggleUserStatus,
  resetUserPassword,
} from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('user.manage'));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id/status', toggleUserStatus);
router.post('/:id/reset-password', resetUserPassword);

export default router;

