// src/modules/hrms/hrms.controller.js
// Handles HTTP for the HRMS module. Thin layer: just parses request and calls service.
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  sanitiseEmployee,
} from './hrms.service.js';
import { Employee } from './Employee.model.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { AppError } from '../../middleware/error.js';

export const list = async (req, res, next) => {
  try {
    const result = await listEmployees(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    // Employees can only view their own full profile
    if (req.user.role === 'EMPLOYEE' && req.user.id !== req.params.id) {
      // Allow but strip sensitive data (handled in sanitiseEmployee)
    }
    const emp = await getEmployee(req.params.id, req.user);
    sendSuccess(res, emp);
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const emp = await createEmployee(req.body, req.user.id);
    sendSuccess(res, emp, 'Employee created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const emp = await updateEmployee(req.params.id, req.body, req.user.id);
    sendSuccess(res, emp, 'Employee updated successfully');
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await deleteEmployee(req.params.id, req.user.id);
    sendSuccess(res, {}, 'Employee soft-deleted successfully');
  } catch (err) {
    next(err);
  }
};

// Upload profile photo — called after multer middleware
export const uploadPhoto = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      { 'personal.photo': { url: req.file.path, publicId: req.file.filename } },
      { new: true }
    );
    if (!emp) throw new AppError('Employee not found', 404);
    sendSuccess(res, { photo: emp.personal.photo }, 'Photo uploaded');
  } catch (err) {
    next(err);
  }
};

// Upload a document — called after multer middleware
export const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const { type } = req.body;
    const docEntry = {
      type: type || 'OTHER',
      url: req.file.path,
      publicId: req.file.filename,
      uploadedBy: req.user.id,
    };
    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      { $push: { documents: docEntry } },
      { new: true }
    );
    if (!emp) throw new AppError('Employee not found', 404);
    sendSuccess(res, { document: docEntry }, 'Document uploaded');
  } catch (err) {
    next(err);
  }
};
