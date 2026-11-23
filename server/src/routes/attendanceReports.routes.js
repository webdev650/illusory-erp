import { Router } from 'express';
import {
  getMonthlyRegisterReport,
  getLateArrivalsReport,
  getLeaveBalanceReport,
  getRegularizationReport,
  getRemoteWorkReport,
  getOvertimeReport,
  getCompOffCreditsReport,
  getAbsenteeReport,
  getMissingPunchesReport,
} from '../controllers/attendanceReports.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// All reports scoped in controller: managers see team only, employees blocked (403), HR/Admin see all
router.get('/monthly-register', getMonthlyRegisterReport);
router.get('/late-arrivals', getLateArrivalsReport);
router.get('/leave-balance', getLeaveBalanceReport);
router.get('/regularization', getRegularizationReport);
router.get('/remote-work', getRemoteWorkReport);
router.get('/overtime', getOvertimeReport);
router.get('/comp-off', getCompOffCreditsReport);
router.get('/absentee', getAbsenteeReport);
router.get('/missing-punches', getMissingPunchesReport);

export default router;
