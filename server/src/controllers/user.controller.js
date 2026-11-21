import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .populate('role')
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .sort({ createdAt: -1 });

    return sendSuccess(res, users, 'Users retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { email, roleKey, employeeId } = req.body;

    // Check if role exists
    const role = await Role.findOne({ key: roleKey });
    if (!role) {
      return sendError(res, `Role '${roleKey}' does not exist`, 400);
    }

    // Role creation rules:
    // Only super_admin can create another super_admin
    if (roleKey === 'super_admin' && req.userRole !== 'super_admin') {
      return sendError(res, 'Only a super_admin can create another super_admin', 403);
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return sendError(res, 'A user with this email already exists', 409);
    }

    const defaultPassword = 'ChangeMe@123';
    const passwordHash = await User.hashPassword(defaultPassword);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role: role._id,
      employee: employeeId || null,
      mustChangePassword: true,
      isActive: true,
    });

    const populated = await User.findById(user._id).populate('role').populate('employee');

    await logAudit({
      req,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: user._id,
      changes: { email: user.email, role: roleKey },
    });

    return sendSuccess(
      res,
      {
        user: populated,
        temporaryPassword: defaultPassword,
      },
      `User created successfully with role: ${role.name}`,
      201
    );
  } catch (error) {
    next(error);
  }
};

export const toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (String(req.user._id) === String(id)) {
      return sendError(res, 'You cannot deactivate your own account', 400);
    }

    const targetUser = await User.findById(id).populate('role');
    if (!targetUser) {
      return sendError(res, 'User not found', 404);
    }

    // Admin cannot modify a super_admin
    if (targetUser.role?.key === 'super_admin' && req.userRole !== 'super_admin') {
      return sendError(res, 'Admins cannot deactivate a super_admin', 403);
    }

    targetUser.isActive = !targetUser.isActive;
    await targetUser.save();

    await logAudit({
      req,
      action: targetUser.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entity: 'User',
      entityId: id,
    });

    return sendSuccess(
      res,
      targetUser,
      `User account ${targetUser.isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error) {
    next(error);
  }
};

export const resetUserPassword = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await User.findById(id).populate('role');
    if (!targetUser) {
      return sendError(res, 'User not found', 404);
    }

    // Admin cannot reset a super_admin's password
    if (targetUser.role?.key === 'super_admin' && req.userRole !== 'super_admin') {
      return sendError(res, 'Admins cannot reset passwords for super_admins', 403);
    }

    const newTempPassword = 'ChangeMe@123';
    targetUser.passwordHash = await User.hashPassword(newTempPassword);
    targetUser.mustChangePassword = true;
    await targetUser.save();

    await logAudit({
      req,
      action: 'ADMIN_RESET_PASSWORD',
      entity: 'User',
      entityId: id,
    });

    return sendSuccess(
      res,
      { temporaryPassword: newTempPassword },
      'Password reset to temporary password (ChangeMe@123). User will be prompted to change it on next login.'
    );
  } catch (error) {
    next(error);
  }
};

export const forcePasswordReset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id).populate('role');
    if (!targetUser) {
      return sendError(res, 'User not found', 404);
    }

    if (targetUser.role?.key === 'super_admin' && req.userRole !== 'super_admin') {
      return sendError(res, 'Admins cannot force password reset on super_admins', 403);
    }

    targetUser.mustChangePassword = true;
    targetUser.failedLoginAttempts = 0;
    targetUser.lockUntil = null;
    await targetUser.save();

    await logAudit({
      req,
      action: 'ADMIN_FORCE_PASSWORD_RESET',
      entity: 'User',
      entityId: id,
    });

    return sendSuccess(
      res,
      targetUser,
      `User ${targetUser.email} must change password on their next login`
    );
  } catch (error) {
    next(error);
  }
};

