import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { upload, taskAttachmentUpload } from '../middleware/upload.js';
import {
  getTasks,
  getMyTasks,
  getTaskById,
  createTask,
  updateTask,
  patchTaskStatus,
  reorderTasks,
  bulkUpdateTasks,
  deleteTask,
  addTaskComment,
  updateTaskComment,
  deleteTaskComment,
  getTaskComments,
  getTaskActivity,
  uploadTaskAttachment,
} from '../controllers/task.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission(['task.read', 'task.readOwn']), getTasks);
router.get('/my', requirePermission(['task.read', 'task.readOwn']), getMyTasks);
router.get('/:id', requirePermission(['task.read', 'task.readOwn']), getTaskById);

router.post('/', requirePermission('task.create'), createTask);
router.put('/:id', requirePermission('task.update'), updateTask);
router.patch('/:id/status', requirePermission('task.update'), patchTaskStatus);
router.post('/reorder', requirePermission('task.update'), reorderTasks);
router.post('/bulk-update', requirePermission('task.update'), bulkUpdateTasks);
router.delete('/:id', requirePermission('task.delete'), deleteTask);

router.post('/:id/comments', requirePermission('task.comment'), addTaskComment);
router.put('/:id/comments/:commentId', requirePermission('task.comment'), updateTaskComment);
router.delete('/:id/comments/:commentId', requirePermission('task.comment'), deleteTaskComment);
router.get('/:id/comments', requirePermission(['task.read', 'task.readOwn']), getTaskComments);
router.get('/:id/activity', requirePermission(['task.read', 'task.readOwn']), getTaskActivity);

router.post('/:id/attachments', requirePermission('task.update'), taskAttachmentUpload.single('file'), uploadTaskAttachment);

export default router;

