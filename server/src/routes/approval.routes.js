import { Router } from 'express';
import {
  getMyRequests,
  getPendingForMe,
  approveRequest,
  rejectRequest,
  cancelRequest,
} from '../controllers/approval.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/my-requests', getMyRequests);
router.get('/pending-for-me', getPendingForMe);
router.post('/:id/approve', approveRequest);
router.post('/:id/reject', rejectRequest);
router.post('/:id/cancel', cancelRequest);

export default router;
