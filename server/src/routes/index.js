import { Router } from 'express';
import authRoutes from './auth.routes.js';
import employeeRoutes from './employee.routes.js';
import departmentRoutes from './department.routes.js';
import roleRoutes from './role.routes.js';
import userRoutes from './user.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import approvalRoutes from './approval.routes.js';
import notificationRoutes from './notification.routes.js';
import hrRoutes from './hr.routes.js';
import clientRoutes from './client.routes.js';
import projectRoutes from './project.routes.js';
import taskRoutes from './task.routes.js';
import activityRoutes from './activity.routes.js';
import assetRoutes from './asset.routes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Illusory ERP API v1 is operational 🚀',
    timestamp: new Date(),
  });
});

// Mount modular sub-routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/departments', departmentRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/approvals', approvalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/hr', hrRoutes);
router.use('/clients', clientRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/activity', activityRoutes);
router.use('/assets', assetRoutes);

export default router;
