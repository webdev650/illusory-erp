import { Router } from 'express';
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  updateEmployeeStatus,
  getMyProfile,
  updateMyProfile,
  uploadEmployeePhoto,
  uploadEmployeeDocument,
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
router.get('/', requirePermission('employee.read'), listEmployees);
router.post('/', requirePermission('employee.create'), createEmployee);
router.get('/:id', getEmployeeById);
router.put('/:id', requirePermission('employee.update'), updateEmployee);
router.delete('/:id', requirePermission('employee.delete'), deleteEmployee);
router.patch('/:id/status', requirePermission('employee.update'), updateEmployeeStatus);

// Upload routes
router.post('/:id/photo', upload.single('photo'), uploadEmployeePhoto);
router.post(
  '/:id/documents',
  requirePermission('employee.update'),
  upload.single('document'),
  uploadEmployeeDocument
);

export default router;

