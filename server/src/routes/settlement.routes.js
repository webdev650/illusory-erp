import { Router } from 'express';
import {
  getPolicyYears,
  createPolicyYear,
  getSettlementMatrix,
  saveSettlementDraft,
  saveWithSettlement,
  finalisePolicyYear,
  reopenPolicyYear,
  recalculateBalances,
  getEmployeeSettlementHistory,
  importOpeningBalances,
  exportSettlementSheet,
  exportLeaveLedger,
  getPolicyComparison,
  updatePolicyYearSettings,
} from '../controllers/settlement.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

// All settlement endpoints restricted to leave.settle (HR and Super Admin only; managers blocked)
router.get('/years', requirePermission('leave.settle'), getPolicyYears);
router.post('/years', requirePermission('leave.settle'), createPolicyYear);
router.get('/matrix', requirePermission('leave.settle'), getSettlementMatrix);
router.post('/draft', requirePermission('leave.settle'), saveSettlementDraft);
router.post('/settle', requirePermission('leave.settle'), saveWithSettlement);
router.post('/finalise', requirePermission('leave.settle'), finalisePolicyYear);
router.post('/reopen', requirePermission('leave.settle'), reopenPolicyYear);
router.post('/recalculate', requirePermission('leave.settle'), recalculateBalances);
router.get('/history/:employeeId', requirePermission('leave.settle'), getEmployeeSettlementHistory);
router.post('/import', requirePermission('leave.settle'), importOpeningBalances);
router.get('/export/settlement', requirePermission('leave.settle'), exportSettlementSheet);
router.get('/export/ledger', requirePermission('leave.settle'), exportLeaveLedger);

// Policy Comparison & Policy Year Settings (HR and Super Admin)
router.get('/policy-comparison', requirePermission('leave.settle'), getPolicyComparison);
router.put('/years/:id/settings', requirePermission('leave.settle'), updatePolicyYearSettings);

export default router;
