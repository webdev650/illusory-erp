import { Router } from 'express';
import healthRoutes from './health.routes.js';
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
import preferenceRoutes from './preference.routes.js';
import hrmsDashboardRoutes from './hrmsDashboard.routes.js';
import attendanceRoutes from './attendance.routes.js';
import letterRoutes from './letter.routes.js';
import performanceRoutes from './performance.routes.js';
import { getMyPerformance } from '../controllers/performance.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { verifyPublicLetter } from '../controllers/letter.controller.js';

const router = Router();

// Public verification endpoint alias
router.get('/verify/:token', verifyPublicLetter);

// Me Performance endpoint
router.get('/me/performance', requireAuth, getMyPerformance);

// Liveness & readiness probes
router.use('/', healthRoutes);

// Mount modular sub-routes
router.use('/auth', authRoutes);
router.use('/employees', employeeRoutes);
router.use('/hrms/dashboard', hrmsDashboardRoutes);
router.use('/hrms', hrmsDashboardRoutes);
router.use('/departments', departmentRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/approvals', approvalRoutes);
router.use('/notifications', notificationRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/letters', letterRoutes);
router.use('/performance', performanceRoutes);
router.use('/hr', hrRoutes);
router.use('/clients', clientRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/activity', activityRoutes);
router.use('/assets', assetRoutes);
router.use('/preferences', preferenceRoutes);

export default router;
