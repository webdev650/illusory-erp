import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

// Attendance controllers
import {
  checkIn,
  checkOut,
  getTodayStatus,
  getMyMonthlyAttendance,
  getTeamAttendance,
  getAllAttendance,
  requestRegularization,
  manualEditAttendance,
} from '../controllers/attendance.controller.js';

// Leave controllers
import {
  getLeaveTypes,
  getLeaveBalances,
  applyLeave,
  getMyLeaveRequests,
  cancelLeave,
  getLeaveCalendar,
  getAllLeaveRequests,
} from '../controllers/leave.controller.js';

// Holiday controllers
import {
  listHolidays,
  getUpcomingHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  bulkImportHolidays,
} from '../controllers/holiday.controller.js';

// Announcement controllers
import {
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getCelebrations,
} from '../controllers/announcement.controller.js';

// HR Dashboard metrics
import { getHRDashboardMetrics } from '../controllers/hrDashboard.controller.js';

const router = Router();

router.use(requireAuth);

// --- HR Dashboard Metrics ---
router.get('/dashboard-metrics', requirePermission('hr.access'), getHRDashboardMetrics);

// --- Attendance Endpoints ---
router.post('/attendance/check-in', checkIn);
router.post('/attendance/check-out', checkOut);
router.get('/attendance/today', getTodayStatus);
router.get('/attendance/my-monthly', getMyMonthlyAttendance);
router.get('/attendance/team', getTeamAttendance);
router.get('/attendance/all', requirePermission('attendance.read'), getAllAttendance);
router.post('/attendance/regularization', requestRegularization);
router.patch('/attendance/:id/manual-edit', requirePermission('attendance.manage'), manualEditAttendance);

// --- Leave Endpoints ---
router.get('/leave/types', getLeaveTypes);
router.get('/leave/balances', getLeaveBalances);
router.post('/leave/apply', applyLeave);
router.get('/leave/my-requests', getMyLeaveRequests);
router.post('/leave/:id/cancel', cancelLeave);
router.get('/leave/calendar', getLeaveCalendar);
router.get('/leave/all', requirePermission('leave.manage'), getAllLeaveRequests);

// --- Holiday Endpoints ---
router.get('/holidays', listHolidays);
router.get('/holidays/upcoming', getUpcomingHolidays);
router.post('/holidays', requirePermission('holiday.manage'), createHoliday);
router.put('/holidays/:id', requirePermission('holiday.manage'), updateHoliday);
router.delete('/holidays/:id', requirePermission('holiday.manage'), deleteHoliday);
router.post('/holidays/bulk', requirePermission('holiday.manage'), bulkImportHolidays);

// --- Announcement & Celebration Endpoints ---
router.get('/announcements', listAnnouncements);
router.post('/announcements', requirePermission('announcement.create'), createAnnouncement);
router.delete('/announcements/:id', requirePermission('announcement.create'), deleteAnnouncement);
router.get('/celebrations', getCelebrations);

export default router;
