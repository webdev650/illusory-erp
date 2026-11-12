// src/modules/hrms/hrms.routes.js
// All /api/hrms/* routes for the employee module.
import { Router } from 'express';
import { protect } from '../../middleware/auth.js';
import { allowRoles } from '../../middleware/role.js';
import { upload } from '../../middleware/upload.js';
import { auditLog } from '../../middleware/audit.js';
import {
  list,
  getOne,
  create,
  update,
  remove,
  uploadPhoto,
  uploadDocument,
} from './hrms.controller.js';

const router = Router();

// All routes require the user to be logged in
router.use(protect);

// --- Employee CRUD ---
// Anyone logged in can list employees (salary/statutory stripped for non-privileged)
router.get('/employees', list);

// Anyone logged in can view an employee (sensitive data stripped for non-privileged)
router.get('/employees/:id', getOne);

// Only HR_ADMIN and SUPER_ADMIN can create employees
router.post(
  '/employees',
  allowRoles('SUPER_ADMIN', 'HR_ADMIN'),
  auditLog('CREATE_EMPLOYEE'),
  create
);

// Only HR_ADMIN and SUPER_ADMIN can update employees
router.put(
  '/employees/:id',
  allowRoles('SUPER_ADMIN', 'HR_ADMIN'),
  auditLog('UPDATE_EMPLOYEE'),
  update
);

// Only SUPER_ADMIN can soft-delete
router.delete(
  '/employees/:id',
  allowRoles('SUPER_ADMIN'),
  auditLog('DELETE_EMPLOYEE'),
  remove
);

// --- Cloudinary Uploads ---
// Upload profile photo (JPG/PNG only, 5 MB max)
router.post(
  '/employees/:id/photo',
  allowRoles('SUPER_ADMIN', 'HR_ADMIN'),
  upload.single('photo'),
  uploadPhoto
);

// Upload a document (JPG/PNG/PDF, 5 MB max)
router.post(
  '/employees/:id/documents',
  allowRoles('SUPER_ADMIN', 'HR_ADMIN'),
  upload.single('document'),
  uploadDocument
);

export default router;
