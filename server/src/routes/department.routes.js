import { Router } from 'express';
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/department.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(requireAuth);

router.get('/', listDepartments);
router.post('/', requirePermission('department.manage'), createDepartment);
router.put('/:id', requirePermission('department.manage'), updateDepartment);
router.delete('/:id', requirePermission('department.manage'), deleteDepartment);

export default router;

