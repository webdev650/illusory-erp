import { Router } from 'express';
import {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
  getRosterMatrix,
  assignRoster,
  getRosterHistory,
} from '../controllers/roster.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

// Shift Templates
router.get('/shifts', getShifts);
router.post('/shifts', requirePermission('system.manage'), createShift);
router.put('/shifts/:id', requirePermission('system.manage'), updateShift);
router.delete('/shifts/:id', requirePermission('system.manage'), deleteShift);

// Roster Matrix & Assignment
router.get('/matrix', getRosterMatrix);
router.post('/assign', requirePermission('attendance.manage'), assignRoster);
router.get('/history', getRosterHistory);

export default router;
