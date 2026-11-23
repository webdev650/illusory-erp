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

// Exporting
router.get('/export', exportAttendance);

export default router;
