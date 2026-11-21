import { Router } from 'express';
import {
  getRegularizationRequests,
  applyRegularizationRequest,
  getLeaveRequests,
  applyLeaveRequest,
  getLeaveBalances,
  getRemoteWorkRequests,
  applyRemoteWorkRequest,
  getPartialDayRequests,
  applyPartialDayRequest,
  getCompOffRequests,
  getCompOffCredits,
  verifyWorkedPresence,
  applyCompOffRequest,
} from '../controllers/requests.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// 1. Regularization
router.get('/regularization', getRegularizationRequests);
router.post('/regularization', applyRegularizationRequest);

// 2. Leave
router.get('/leave', getLeaveRequests);
router.post('/leave', applyLeaveRequest);
router.get('/leave/balances', getLeaveBalances);

// 3. Remote Work
router.get('/remote-work', getRemoteWorkRequests);
router.post('/remote-work', applyRemoteWorkRequest);

// 4. Partial Day
router.get('/partial-day', getPartialDayRequests);
router.post('/partial-day', applyPartialDayRequest);

// 5. Comp-Off
router.get('/comp-off', getCompOffRequests);
router.post('/comp-off', applyCompOffRequest);
router.get('/comp-off/credits', getCompOffCredits);
router.get('/comp-off/verify-presence', verifyWorkedPresence);

export default router;
