import { Router } from 'express';
import {
  getApprovalInbox,
  getApprovalCounts,
  getApprovalDetails,
  approveRequestAction,
  rejectRequestAction,
  returnRequestAction,
  addApprovalComment,
  bulkApprovalAction,
  getDelegationsList,
  createDelegationAction,
  deleteDelegationAction,
  getWorkflowConfig,
  updateWorkflowConfig,
  exportApprovalsCsv,
} from '../controllers/approval.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

// 1. Inbox & Live Counts
router.get('/inbox', getApprovalInbox);
router.get('/counts', getApprovalCounts);
router.get('/export', exportApprovalsCsv);

// 2. Delegations
router.get('/delegations', getDelegationsList);
router.post('/delegations', createDelegationAction);
router.delete('/delegations/:id', deleteDelegationAction);

// 3. Workflow Configurations
router.get('/workflows/:type', getWorkflowConfig);
router.put('/workflows/:type', updateWorkflowConfig);

// 4. Bulk Processing
router.post('/bulk', bulkApprovalAction);

// 5. Individual Approval Details & Actions
router.get('/:id', getApprovalDetails);
router.post('/:id/approve', approveRequestAction);
router.post('/:id/reject', rejectRequestAction);
router.post('/:id/return', returnRequestAction);
router.post('/:id/comment', addApprovalComment);

export default router;
