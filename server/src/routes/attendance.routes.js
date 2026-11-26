import { Router } from 'express';
import {
  getAttendanceCalendar,
  getDayDetails,
  getManageLogs,
  addManualPunch,
  updateManualPunch,
  deleteManualPunch,
  recordSelfPunch,
  getPolicy,
  updatePolicy,
  exportAttendance,
} from '../controllers/attendanceSuite.controller.js';
import {
  getPolicyConfirmations,
  confirmPolicyItem,
  getLatePenalties,
  actOnLatePenalty,
  getCriticalDates,
  createCriticalDate,
  deleteCriticalDate,
  getUnauthorizedAbsences,
  actOnUnauthorizedAbsence,
  getAutomationStatus,
  toggleAutomationSwitch,
  previewMonthlyAccrual,
  previewMissingClockOut,
  previewEodNotPa,
  previewLatePenalties,
} from '../controllers/ruleBookPolicy.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import requestsRoutes from './requests.routes.js';
import bulkRoutes from './bulkAttendance.routes.js';
import rosterRoutes from './roster.routes.js';
import settlementRoutes from './settlement.routes.js';
import reportsRoutes from './attendanceReports.routes.js';

const router = Router();

router.use(requireAuth);

// Requests sub-routes (regularization, leave, remote-work, partial-day, comp-off)
router.use('/requests', requestsRoutes);

// Bulk Attendance sub-routes
router.use('/bulk', bulkRoutes);

// Shift Roster sub-routes
router.use('/roster', rosterRoutes);

// Leave Balance Settlement sub-routes
router.use('/settlement', settlementRoutes);

// Attendance & Leave Reports sub-routes
router.use('/reports', reportsRoutes);

// Calendar & self-service
router.get('/calendar', getAttendanceCalendar);
router.get('/calendar/day', getDayDetails);
router.post('/punch', recordSelfPunch);

// Manage logs (HR/Admin/Managers)
router.get('/manage-logs', getManageLogs);
router.post('/logs', requirePermission('attendance.manage'), addManualPunch);
router.put('/logs/:id', requirePermission('attendance.manage'), updateManualPunch);
router.delete('/logs/:id', requirePermission('attendance.manage'), deleteManualPunch);

// Policy settings
router.get('/policy', getPolicy);
router.put('/policy', requirePermission('system.manage'), updatePolicy);

// Rule Book Policy Confirmation Checklist (Section 12 items)
router.get('/policy/confirmations', getPolicyConfirmations);
router.post('/policy/confirmations/:key', requirePermission(['attendance.manage', 'system.manage', 'hr.access']), confirmPolicyItem);

// Late Penalty Records & Actions
router.get('/late-penalties', getLatePenalties);
router.post('/late-penalties/:id/action', requirePermission(['attendance.manage', 'hr.access']), actOnLatePenalty);

// Critical Dates Calendar
router.get('/critical-dates', getCriticalDates);
router.post('/critical-dates', requirePermission(['attendance.manage', 'hr.access']), createCriticalDate);
router.delete('/critical-dates/:id', requirePermission(['attendance.manage', 'hr.access']), deleteCriticalDate);

// Unauthorized Absences
router.get('/unauthorized-absences', getUnauthorizedAbsences);
router.post('/unauthorized-absences/:id/action', requirePermission(['attendance.manage', 'hr.access']), actOnUnauthorizedAbsence);

// Go-Live Master Safety Switch & Previews
router.get('/automation/status', getAutomationStatus);
router.post('/automation/toggle', toggleAutomationSwitch);
router.get('/automation/preview/monthly-accrual', previewMonthlyAccrual);
router.get('/automation/preview/missing-clockout', previewMissingClockOut);
router.get('/automation/preview/eod-not-pa', previewEodNotPa);
router.get('/automation/preview/late-penalties', previewLatePenalties);

// Exporting
router.get('/export', exportAttendance);

export default router;
