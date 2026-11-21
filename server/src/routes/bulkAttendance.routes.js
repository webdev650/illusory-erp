import { Router } from 'express';
import {
  getTimerStatuses,
  previewBulkPunch,
  executeBulkPunch,
  undoBulkAction,
  getRecentBulkActions,
} from '../controllers/bulkAttendance.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

// All bulk attendance actions require attendance.manage permission or HR/Admin roles
router.get('/timer-statuses', getTimerStatuses);
router.post('/preview', requirePermission('attendance.manage'), previewBulkPunch);
router.post('/execute', requirePermission('attendance.manage'), executeBulkPunch);
router.post('/undo/:bulkActionId', requirePermission('attendance.manage'), undoBulkAction);
router.get('/recent', requirePermission('attendance.manage'), getRecentBulkActions);

export default router;
