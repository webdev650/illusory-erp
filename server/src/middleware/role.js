// src/middleware/role.js
// allowRoles: use after protect to restrict a route to specific roles.
// Example: router.get('/salary', protect, allowRoles('SUPER_ADMIN', 'HR_ADMIN'), ...)
import { AppError } from './error.js';

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(`Access denied. Required role(s): ${roles.join(', ')}`, 403)
      );
    }
    next();
  };
};
