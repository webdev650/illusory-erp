import { Role } from '../models/Role.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const listRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ createdAt: 1 });
    return sendSuccess(res, roles, 'Roles retrieved successfully');
  } catch (error) {
    next(error);
  }
};

