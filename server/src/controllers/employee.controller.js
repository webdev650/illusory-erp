import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { sanitizeEmployee } from '../utils/masking.js';
import { logAudit } from '../middleware/audit.js';
import { initiateExitClearance } from '../services/asset.service.js';

// GET /api/v1/employees - List employees with filters & pagination
export const listEmployees = async (req, res, next) => {
  try {
    const { search, department, status, page = 1, limit = 10 } = req.query;

    const query = { isDeleted: false };

    // Search by firstName, lastName, officialEmail, or employeeId
    if (search) {
      query.$or = [
        { 'personal.firstName': { $regex: search, $options: 'i' } },
        { 'personal.lastName': { $regex: search, $options: 'i' } },
        { 'personal.officialEmail': { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { 'employment.designation': { $regex: search, $options: 'i' } },
      ];
    }

    if (department) {
      query['employment.department'] = department;
    }

    if (status) {
      query.status = status;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawEmployees] = await Promise.all([
      Employee.countDocuments(query),
      Employee.find(query)
        .populate('employment.department', 'name code')
        .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Sanitize employee list (mask sensitive fields)
    const employees = rawEmployees.map((emp) =>
      sanitizeEmployee(emp, req.permissions, false)
    );

    return sendSuccess(
      res,
      {
        employees,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      'Employees retrieved successfully'
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/employees/me - Employee views their own profile
export const getMyProfile = async (req, res, next) => {
  try {
    if (!req.user.employee) {
      return sendError(res, 'No linked employee profile found for your account', 404);
    }

    const employee = await Employee.findById(req.user.employee)
      .populate('employment.department', 'name code')
      .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId');

    if (!employee || employee.isDeleted) {
      return sendError(res, 'Employee profile not found', 404);
    }

    // Pass isSelf = true so they can view masked data & own details
    const sanitized = sanitizeEmployee(employee, req.permissions, true);
    return sendSuccess(res, sanitized, 'Your profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/employees/me - Employee edits limited fields of their own profile
export const updateMyProfile = async (req, res, next) => {
  try {
    if (!req.user.employee) {
      return sendError(res, 'No linked employee profile found for your account', 404);
    }

    const allowedUpdates = {};
    const { phone, personalEmail, currentAddress, permanentAddress, emergencyContacts } = req.body;

    if (phone !== undefined) allowedUpdates['personal.phone'] = phone;
    if (personalEmail !== undefined) allowedUpdates['personal.personalEmail'] = personalEmail;
    if (currentAddress !== undefined) allowedUpdates['personal.currentAddress'] = currentAddress;
    if (permanentAddress !== undefined) allowedUpdates['personal.permanentAddress'] = permanentAddress;
    if (emergencyContacts !== undefined) allowedUpdates.emergencyContacts = emergencyContacts;

    const employee = await Employee.findByIdAndUpdate(
      req.user.employee,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    )
      .populate('employment.department', 'name code')
      .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId');

    await logAudit({
      req,
      action: 'UPDATE_OWN_PROFILE',
      entity: 'Employee',
      entityId: employee._id,
      changes: allowedUpdates,
    });

    const sanitized = sanitizeEmployee(employee, req.permissions, true);
    return sendSuccess(res, sanitized, 'Your profile was updated successfully');
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/employees/:id - Get single employee details
export const getEmployeeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findOne({ _id: id, isDeleted: false })
      .populate('employment.department', 'name code')
      .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId');

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    const isSelf = req.user.employee && String(req.user.employee) === String(employee._id);

    // If an employee attempts to view another employee's profile without permission
    if (!isSelf && !req.permissions.includes('*') && !req.permissions.includes('employee.read')) {
      return sendError(res, 'Access denied. You can only view your own profile.', 403);
    }

    const sanitized = sanitizeEmployee(employee, req.permissions, isSelf);
    return sendSuccess(res, sanitized, 'Employee retrieved successfully');
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/employees - Create employee & auto-generate user account
export const createEmployee = async (req, res, next) => {
  try {
    const data = req.body;

    // Check if email already exists
    const existing = await Employee.findOne({
      'personal.officialEmail': data.personal?.officialEmail?.toLowerCase(),
      isDeleted: false,
    });
    if (existing) {
      return sendError(res, 'An employee with this official email already exists', 409);
    }

    const employee = await Employee.create(data);

    // Auto-create a linked User account
    const employeeRole = await Role.findOne({ key: 'employee' });
    const tempPassword = 'ChangeMe@123';
    const passwordHash = await User.hashPassword(tempPassword);

    const user = await User.create({
      email: employee.personal.officialEmail.toLowerCase(),
      passwordHash,
      role: employeeRole?._id,
      employee: employee._id,
      mustChangePassword: true,
      isActive: true,
    });

    await logAudit({
      req,
      action: 'CREATE_EMPLOYEE',
      entity: 'Employee',
      entityId: employee._id,
      changes: {
        employeeId: employee.employeeId,
        email: employee.personal.officialEmail,
        userId: user._id,
      },
    });

    return sendSuccess(
      res,
      {
        employee,
        userCredentials: {
          email: user.email,
          temporaryPassword: tempPassword,
        },
      },
      'Employee created successfully with temporary login credentials',
      201
    );
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/employees/:id - Update employee
export const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const current = await Employee.findOne({ _id: id, isDeleted: false });
    if (!current) {
      return sendError(res, 'Employee not found', 404);
    }

    const updateData = { ...req.body };

    // Record history if designation or department changes
    const historyEntries = [];
    if (
      updateData.employment?.designation &&
      updateData.employment.designation !== current.employment?.designation
    ) {
      historyEntries.push({
        date: new Date(),
        type: 'ROLE_CHANGE',
        from: current.employment?.designation || '',
        to: updateData.employment.designation,
        remarks: 'Designation updated',
      });
    }

    if (
      updateData.employment?.department &&
      String(updateData.employment.department) !== String(current.employment?.department)
    ) {
      historyEntries.push({
        date: new Date(),
        type: 'TRANSFER',
        from: String(current.employment?.department || ''),
        to: String(updateData.employment.department),
        remarks: 'Department transferred',
      });
    }

    if (historyEntries.length > 0) {
      updateData.$push = { history: { $each: historyEntries } };
    }

    const updated = await Employee.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('employment.department', 'name code')
      .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId');

    await logAudit({
      req,
      action: 'UPDATE_EMPLOYEE',
      entity: 'Employee',
      entityId: id,
      changes: req.body,
    });

    return sendSuccess(res, updated, 'Employee updated successfully');
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/employees/:id - Soft delete
export const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findOne({ _id: id, isDeleted: false });
    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    employee.isDeleted = true;
    employee.status = 'inactive';
    await employee.save();

    // Deactivate linked User account
    await User.updateOne({ employee: id }, { isActive: false });

    await logAudit({
      req,
      action: 'SOFT_DELETE_EMPLOYEE',
      entity: 'Employee',
      entityId: id,
    });

    return sendSuccess(res, null, 'Employee has been soft-deleted and access deactivated');
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/employees/:id/status - Update employee status
export const updateEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;

    const validStatuses = ['active', 'probation', 'notice', 'resigned', 'terminated', 'inactive'];
    if (!validStatuses.includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const employee = await Employee.findOne({ _id: id, isDeleted: false });
    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    const oldStatus = employee.status;
    employee.status = status;
    employee.history.push({
      date: new Date(),
      type: 'STATUS_CHANGE',
      from: oldStatus,
      to: status,
      remarks: remarks || `Status transitioned from ${oldStatus} to ${status}`,
    });

    await employee.save();

    // Trigger exit clearance checklist if transitioning to notice, resigned, or terminated
    if (['notice', 'resigned', 'terminated'].includes(status)) {
      try {
        await initiateExitClearance(id);
      } catch (clearanceErr) {
        console.warn('Exit clearance initiation error:', clearanceErr.message);
      }
    }

    // If resigned or terminated or inactive, deactivate user
    if (['resigned', 'terminated', 'inactive'].includes(status)) {
      await User.updateOne({ employee: id }, { isActive: false });
    } else {
      await User.updateOne({ employee: id }, { isActive: true });
    }

    await logAudit({
      req,
      action: 'CHANGE_EMPLOYEE_STATUS',
      entity: 'Employee',
      entityId: id,
      changes: { from: oldStatus, to: status, remarks },
    });

    return sendSuccess(res, employee, `Employee status changed to ${status}`);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/employees/:id/photo - Upload profile picture
export const uploadEmployeePhoto = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return sendError(res, 'No photo provided', 400);
    }

    const isSelf = req.user.employee && String(req.user.employee) === String(id);
    const hasUploadPerm = req.permissions.includes('*') || req.permissions.includes('employee.update');

    if (!isSelf && !hasUploadPerm) {
      return sendError(res, 'You do not have permission to change this photo', 403);
    }

    const photoData = {
      url: req.file.path,
      publicId: req.file.filename,
    };

    const employee = await Employee.findByIdAndUpdate(
      id,
      { 'personal.photo': photoData },
      { new: true }
    );

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    await logAudit({
      req,
      action: 'UPLOAD_PHOTO',
      entity: 'Employee',
      entityId: id,
      changes: photoData,
    });

    return sendSuccess(res, photoData, 'Photo uploaded successfully');
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/employees/:id/documents - Upload employee document
export const uploadEmployeeDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return sendError(res, 'No document file provided', 400);
    }

    const { type, name } = req.body;

    const docEntry = {
      type: type || 'OTHER',
      name: name || req.file.originalname,
      url: req.file.path,
      publicId: req.file.filename,
      uploadedAt: new Date(),
    };

    const employee = await Employee.findByIdAndUpdate(
      id,
      { $push: { documents: docEntry } },
      { new: true }
    );

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    await logAudit({
      req,
      action: 'UPLOAD_DOCUMENT',
      entity: 'Employee',
      entityId: id,
      changes: docEntry,
    });

    return sendSuccess(res, docEntry, 'Document uploaded successfully', 201);
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/employees/:id/manager - Update reporting manager
export const updateReportingManager = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    const employee = await Employee.findOne({ _id: id, isDeleted: false });
    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    if (managerId) {
      if (String(managerId) === String(id)) {
        return sendError(res, 'An employee cannot be their own reporting manager', 400);
      }
      const manager = await Employee.findOne({ _id: managerId, isDeleted: false });
      if (!manager) {
        return sendError(res, 'Reporting manager not found', 404);
      }
      employee.employment.reportingManager = manager._id;
    } else {
      employee.employment.reportingManager = null;
    }

    await employee.save();

    await logAudit({
      req,
      action: 'UPDATE_REPORTING_MANAGER',
      entity: 'Employee',
      entityId: id,
      changes: { reportingManager: managerId || null },
    });

    const populated = await Employee.findById(id)
      .populate('employment.department', 'name code')
      .populate('employment.reportingManager', 'personal.firstName personal.lastName employeeId');

    const sanitized = sanitizeEmployee(populated, req.permissions, false);
    return sendSuccess(res, sanitized, 'Reporting manager updated successfully');
  } catch (error) {
    next(error);
  }
};

