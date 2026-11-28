import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import {
  getRoleMenuConfigs,
  updateRoleMenuConfig,
  getMyMenuConfig,
  getGreetings,
  createGreeting,
  updateGreeting,
  deleteGreeting,
  getResolvedHomeGreeting,
} from '../controllers/menuConfig.controller.js';

const router = Router();

// Menu configuration routes
router.get('/menu-access', requireAuth, requirePermission(['user.manage', 'hr.access', 'dashboard.read']), getRoleMenuConfigs);
router.put('/menu-access/:roleKey', requireAuth, requirePermission(['user.manage', 'hr.access']), updateRoleMenuConfig);
router.get('/menu-access/my-menu', requireAuth, getMyMenuConfig);

// Banner greeting routes
router.get('/greetings', requireAuth, getGreetings);
router.post('/greetings', requireAuth, requirePermission(['user.manage', 'hr.access']), createGreeting);
router.put('/greetings/:id', requireAuth, requirePermission(['user.manage', 'hr.access']), updateGreeting);
router.delete('/greetings/:id', requireAuth, requirePermission(['user.manage', 'hr.access']), deleteGreeting);

// Home greeting endpoint (open to any authenticated user)
router.get('/greeting', requireAuth, getResolvedHomeGreeting);

export default router;
