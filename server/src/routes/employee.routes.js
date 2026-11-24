import { Router } from 'express';
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  updateReportingManager,
  getMyProfile,
  updateMyProfile,
  uploadEmployeePhoto,
  uploadEmployeeDocument,
  getEmployeeSummary,
  getOrgChart,
  getDataQualityAudit,
  bulkEmployeeAction,
  triggerLifecycleAction,
  revealSensitiveField,
  submitProfileChangeRequest,
} from '../controllers/employee.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import employeeImportRoutes from './employeeImport.routes.js';

const router = Router();

router.use(requireAuth);

// Employee Excel Import routes (must precede /:id)
router.use('/import', employeeImportRoutes);

// Employee Self-Service routes (MUST come before /:id routes)
router.get('/me', getMyProfile);
router.put('/me', updateMyProfile);

// Admin / HR Management routes
router.get('/summary', getEmployeeSummary);
router.get('/orgchart', getOrgChart);
router.get('/data-quality', requirePermission('employee.read'), getDataQualityAudit);
router.post('/bulk-action', requirePermission('employee.update'), bulkEmployeeAction);
router.post('/me/profile-change', submitProfileChangeRequest);

router.get('/', requirePermission('employee.read'), listEmployees);
router.post('/', requirePermission('employee.create'), createEmployee);
router.get('/:id', getEmployeeById);
router.put('/:id', requirePermission('employee.update'), updateEmployee);
router.delete('/:id', requirePermission('employee.delete'), deleteEmployee);
router.patch('/:id/status', requirePermission('employee.update'), updateEmployeeStatus);
router.patch('/:id/manager', requirePermission('employee.update'), updateReportingManager);
router.post('/:id/lifecycle/:action', requirePermission('employee.lifecycle'), triggerLifecycleAction);
router.post('/:id/reveal', requirePermission('employee.revealSensitive'), revealSensitiveField);

// Upload routes
router.post('/:id/photo', upload.single('photo'), uploadEmployeePhoto);
router.post(
  '/:id/documents',
  requirePermission('employee.update'),
  upload.single('document'),
  uploadEmployeeDocument
);

export default router;

