// src/modules/hrms/hrms.service.js
// All the business logic for employee CRUD operations.
import { Employee } from './Employee.model.js';
import { AuditLog } from './AuditLog.model.js';
import { AppError } from '../../middleware/error.js';
import { decrypt } from '../../utils/encrypt.js';

// Roles that can see salary and statutory data
const PRIVILEGED_ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE'];

/**
 * Strips sensitive fields from an employee object for non-privileged users.
 * We convert to a plain JS object first so we can delete properties.
 */
export const sanitiseEmployee = (employee, requestingUserRole, requestingUserId) => {
  const emp = employee.toObject ? employee.toObject() : { ...employee };

  const isPrivileged = PRIVILEGED_ROLES.includes(requestingUserRole);
  const isSelf = String(emp.userId) === String(requestingUserId);

  // Non-privileged users cannot see salary or statutory data of others
  if (!isPrivileged && !isSelf) {
    delete emp.salary;
    delete emp.statutory;
    delete emp.bank;
  }

  // Decrypt statutory fields for privileged users
  if (isPrivileged) {
    if (emp.statutory?.aadhaar) emp.statutory.aadhaar = decrypt(emp.statutory.aadhaar);
    if (emp.statutory?.pan) emp.statutory.pan = decrypt(emp.statutory.pan);
    if (emp.bank?.accountNumber) emp.bank.accountNumber = decrypt(emp.bank.accountNumber);
  }

  return emp;
};

/** List employees with pagination, search, and filters */
export const listEmployees = async ({ page = 1, limit = 20, search, department, status }, requestingUser) => {
  const query = { isDeleted: false };

  // Text search across name and employee ID
  if (search) {
    query.$or = [
      { 'personal.fullName': { $regex: search, $options: 'i' } },
      { 'employment.employeeId': { $regex: search, $options: 'i' } },
      { 'contact.officialEmail': { $regex: search, $options: 'i' } },
    ];
  }

  if (department) query['employment.department'] = { $regex: department, $options: 'i' };
  if (status) query['employment.status'] = status.toUpperCase();

  // Non-privileged employees can only see basic info (not salary/statutory)
  const skip = (Number(page) - 1) * Number(limit);
  const [employees, total] = await Promise.all([
    Employee.find(query)
      .select('-salary -statutory -bank -isDeleted')  // Strip sensitive by default
      .populate('employment.reportingManager', 'personal.fullName employment.employeeId')
      .sort({ 'employment.employeeId': 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Employee.countDocuments(query),
  ]);

  return {
    employees,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/** Get a single employee by ID */
export const getEmployee = async (id, requestingUser) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false })
    .populate('employment.reportingManager', 'personal.fullName employment.employeeId employment.designation');

  if (!employee) throw new AppError('Employee not found', 404);

  return sanitiseEmployee(employee, requestingUser.role, requestingUser.id);
};

/** Create a new employee */
export const createEmployee = async (data, createdBy) => {
  const employee = await Employee.create(data);
  return employee;
};

/** Update an employee — records employment history for key changes */
export const updateEmployee = async (id, data, updatedBy) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw new AppError('Employee not found', 404);

  // Track employment-related changes in history
  const empChanges = [];
  if (data.employment?.designation && data.employment.designation !== employee.employment?.designation) {
    empChanges.push({
      date: new Date(),
      changeType: 'ROLE_CHANGE',
      from: { designation: employee.employment?.designation },
      to: { designation: data.employment.designation },
      recordedBy: updatedBy,
    });
  }
  if (data.employment?.department && data.employment.department !== employee.employment?.department) {
    empChanges.push({
      date: new Date(),
      changeType: 'TRANSFER',
      from: { department: employee.employment?.department },
      to: { department: data.employment.department },
      recordedBy: updatedBy,
    });
  }

  // Deep merge using Object.assign for nested objects
  const updateData = { ...data };
  if (empChanges.length > 0) {
    updateData.$push = { employmentHistory: { $each: empChanges } };
  }

  const updated = await Employee.findByIdAndUpdate(id, updateData, {
    new: true,       // Return the updated document
    runValidators: true,
  });

  return updated;
};

/** Soft-delete an employee */
export const deleteEmployee = async (id, deletedBy) => {
  const employee = await Employee.findOne({ _id: id, isDeleted: false });
  if (!employee) throw new AppError('Employee not found', 404);

  await Employee.findByIdAndUpdate(id, {
    isDeleted: true,
    deletedAt: new Date(),
    deletedBy,
  });
};
