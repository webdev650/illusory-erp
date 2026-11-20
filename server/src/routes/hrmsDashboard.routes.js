import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getStatusSummary,
  getOverviewStats,
  getStrength,
  getNetGrowth,
  getDistribution,
  getLeaveTypes,
  getLateReasons,
  getGrowth,
  getLateAttendance,
  getLateToday,
  getNoLeave,
  getMoodSummary,
  recordMoodCheckin,
  getWarnings,
  createWarning,
  closeWarning,
} from '../controllers/hrmsDashboard.controller.js';

const router = Router();

// Require authenticated session for all endpoints
router.use(requireAuth);

// Analytics endpoints (Scoped inside controller: HR/Admin all, Manager team, Employee 403)
router.get('/status-summary', getStatusSummary);
router.get('/overview-stats', getOverviewStats);
router.get('/strength', getStrength);
router.get('/net-growth', getNetGrowth);
router.get('/distribution', getDistribution);
router.get('/leave-types', getLeaveTypes);
router.get('/late-reasons', getLateReasons);
router.get('/growth', getGrowth);
router.get('/late-attendance', getLateAttendance);
router.get('/late-today', getLateToday);
router.get('/no-leave', getNoLeave);
router.get('/mood-summary', getMoodSummary);

// Daily voluntary mood check-in (Any authenticated employee)
router.post('/mood-checkin', recordMoodCheckin);

// Warnings & PIP management
router.get('/warnings', getWarnings);
router.post('/warnings', createWarning);
router.patch('/warnings/:id/close', closeWarning);

export default router;
