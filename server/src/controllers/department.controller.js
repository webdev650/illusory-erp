import { Department } from '../models/Department.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

export const listDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find({ isDeleted: false })
      .populate('head', 'personal.firstName personal.lastName employeeId')
      .sort({ name: 1 });

    return sendSuccess(res, departments, 'Departments retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, head } = req.body;

    const existing = await Department.findOne({
      $or: [{ code: code.toUpperCase() }, { name }],
      isDeleted: false,
    });

    if (existing) {
      return sendError(res, 'A department with this name or code already exists', 409);
    }

    const department = await Department.create({
      name,
      code: code.toUpperCase(),
      description,
      head: head || null,
    });

    await logAudit({
      req,
      action: 'CREATE_DEPARTMENT',
      entity: 'Department',
      entityId: department._id,
      changes: req.body,
    });

    return sendSuccess(res, department, 'Department created successfully', 201);
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await Department.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('head', 'personal.firstName personal.lastName employeeId');

    if (!department) {
      return sendError(res, 'Department not found', 404);
    }

    await logAudit({
      req,
      action: 'UPDATE_DEPARTMENT',
      entity: 'Department',
      entityId: id,
      changes: req.body,
    });

    return sendSuccess(res, department, 'Department updated successfully');
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await Department.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!department) {
      return sendError(res, 'Department not found', 404);
    }

    await logAudit({
      req,
      action: 'DELETE_DEPARTMENT',
      entity: 'Department',
      entityId: id,
    });

    return sendSuccess(res, null, 'Department deleted successfully');
  } catch (error) {
    next(error);
  }
};
