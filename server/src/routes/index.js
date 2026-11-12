import { Router } from 'express';
import authRoutes from './auth.routes.js';
import employeeRoutes from './employee.routes.js';
import departmentRoutes from './department.routes.js';
import roleRoutes from './role.routes.js';
import userRoutes from './user.routes.js';
import dashboardRoutes from './dashboard.routes.js';

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

export default router;
