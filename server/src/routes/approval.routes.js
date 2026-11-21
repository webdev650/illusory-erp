import { Router } from 'express';
import {
  getMyRequests,
  getPendingForMe,
  approveRequest,
  rejectRequest,
  cancelRequest,
  reassignApprover,
  bulkAction,
  getMyDelegations,
  setDelegation,
} from '../controllers/approval.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/my-requests', getMyRequests);
router.get('/pending-for-me', getPendingForMe);
router.post('/bulk-action', bulkAction);
router.post('/:id/approve', approveRequest);
router.post('/:id/reject', rejectRequest);
router.post('/:id/cancel', cancelRequest);
router.post('/:id/reassign', reassignApprover);

// Delegations
router.get('/delegation', getMyDelegations);
router.post('/delegation', setDelegation);

export default router;
