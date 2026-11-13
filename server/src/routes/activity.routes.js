import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  bulkCreateTimeEntries,
  getActiveTimer,
  startActiveTimer,
  stopActiveTimer,
  discardActiveTimer,
  getMyTimesheets,
  getTimesheetByWeek,
  submitTimesheet,
  getPendingTimesheets,
  reopenTimesheet,
  getReportByProject,
  getReportByEmployee,
  getReportByCategory,
  getMissingTimesheetsReport,
  exportActivityData,
} from '../controllers/activity.controller.js';

const router = Router();

router.use(requireAuth);

// 1. Time Entries
router.get(
  '/entries',
  requirePermission(['activity.readOwn', 'activity.readTeam', 'activity.readAll']),
  getTimeEntries
);
router.post('/entries', requirePermission('activity.logOwn'), createTimeEntry);
router.put('/entries/:id', requirePermission('activity.logOwn'), updateTimeEntry);
router.delete('/entries/:id', requirePermission('activity.logOwn'), deleteTimeEntry);
router.post('/entries/bulk', requirePermission('activity.logOwn'), bulkCreateTimeEntries);

// 2. Live Running Timer
router.get('/timer', requirePermission('activity.logOwn'), getActiveTimer);
router.post('/timer/start', requirePermission('activity.logOwn'), startActiveTimer);
router.post('/timer/stop', requirePermission('activity.logOwn'), stopActiveTimer);
router.delete('/timer', requirePermission('activity.logOwn'), discardActiveTimer);

// 3. Weekly Timesheets
router.get('/timesheets/my', requirePermission('activity.readOwn'), getMyTimesheets);
router.get(
  '/timesheets/pending',
  requirePermission(['activity.approve', 'activity.readTeam', 'activity.readAll']),
  getPendingTimesheets
);
router.get(
  '/timesheets/:weekStart',
  requirePermission(['activity.readOwn', 'activity.readTeam', 'activity.readAll']),
  getTimesheetByWeek
);
router.post('/timesheets/:weekStart/submit', requirePermission('activity.logOwn'), submitTimesheet);
router.post('/timesheets/:id/reopen', requirePermission('activity.editAll'), reopenTimesheet);

// 4. Reports & Exports
router.get(
  '/reports/by-project',
  requirePermission(['activity.readTeam', 'activity.readAll']),
  getReportByProject
);
router.get(
  '/reports/by-employee',
  requirePermission(['activity.readTeam', 'activity.readAll']),
  getReportByEmployee
);
router.get(
  '/reports/by-category',
  requirePermission(['activity.readTeam', 'activity.readAll']),
  getReportByCategory
);
router.get(
  '/reports/missing-timesheets',
  requirePermission(['activity.readTeam', 'activity.readAll']),
  getMissingTimesheetsReport
);
router.get('/export', requirePermission('activity.export'), exportActivityData);

export default router;

