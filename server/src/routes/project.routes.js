import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { upload, taskAttachmentUpload } from '../middleware/upload.js';
import {
  getProjects,
  getMyProjects,
  getProjectsSummary,
  getProjectById,
  createProject,
  updateProject,
  changeProjectStatus,
  addProjectMember,
  removeProjectMember,
  addMilestone,
  updateMilestone,
  uploadProjectAttachment,
  deleteProject,
} from '../controllers/project.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission(['project.read', 'project.readOwn']), getProjects);
router.get('/my', requirePermission(['project.read', 'project.readOwn']), getMyProjects);
router.get('/summary', requirePermission(['project.read', 'project.readOwn']), getProjectsSummary);
router.get('/:id', requirePermission(['project.read', 'project.readOwn']), getProjectById);

router.post('/', requirePermission('project.create'), createProject);
router.put('/:id', requirePermission('project.update'), updateProject);
router.patch('/:id/status', requirePermission('project.update'), changeProjectStatus);

router.post('/:id/members', requirePermission('project.manageMembers'), addProjectMember);
router.delete('/:id/members/:employeeId', requirePermission('project.manageMembers'), removeProjectMember);

router.post('/:id/milestones', requirePermission('project.update'), addMilestone);
router.put('/:id/milestones/:milestoneId', requirePermission('project.update'), updateMilestone);

router.post('/:id/attachments', requirePermission('project.update'), taskAttachmentUpload.single('file'), uploadProjectAttachment);
router.delete('/:id', requirePermission('project.delete'), deleteProject);

export default router;

