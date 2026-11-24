import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { LeavePolicyYear } from '../models/LeavePolicyYear.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { sanitizeEmployee } from '../utils/masking.js';
import { logAudit } from '../middleware/audit.js';
import { initiateExitClearance } from '../services/asset.service.js';
import { recalculatePolicyYearBalances } from '../services/settlement.service.js';
import { executeLifecycleAction } from '../services/employeeLifecycle.service.js';
import { getOrgChartTree, auditEmployeeDataQuality } from '../services/employeeAudit.service.js';
import { calculateProfileCompleteness } from '../utils/completeness.js';

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

    // Sanitize employee list (mask sensitive fields) and attach completeness %
    const employees = rawEmployees.map((emp) => {
      const sanitized = sanitizeEmployee(emp, req.permissions, false);
      const completeness = calculateProfileCompleteness(emp);
      sanitized.completeness = completeness;
      return sanitized;
    });

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

// PATCH /api/v1/employees/:id/status - Set employment status (probation / confirmed / notice)
export const updateEmployeeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, confirmationDate, reason, remarks, isVerified = false } = req.body;

    const validStatuses = ['active', 'confirmed', 'probation', 'notice', 'resigned', 'terminated', 'inactive'];
    if (!status || !validStatuses.includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const employee = await Employee.findOne({ _id: id, isDeleted: false });
    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    const oldStatus = employee.status;
    const targetStatus = status === 'confirmed' ? 'active' : status;
    employee.status = targetStatus;

    if (!employee.employment) employee.employment = {};

    // Update verification flags
    employee.employment.isStatusVerified = Boolean(isVerified);

    if (targetStatus === 'active') {
      const confDate = confirmationDate ? new Date(confirmationDate) : new Date();
      employee.employment.confirmationDate = confDate;
      employee.employment.probationEndDate = confDate;
      employee.employment.employeeType = 'Full-Time';
      employee.employment.isConfirmationDateVerified = Boolean(isVerified);
    } else if (targetStatus === 'probation') {
      employee.employment.employeeType = 'Probation';
      employee.employment.confirmationDate = null;
      employee.employment.isConfirmationDateVerified = false;
    }

    const changeReason = reason || remarks || `Status transitioned from ${oldStatus} to ${targetStatus}`;

    employee.history.push({
      date: new Date(),
      type: 'STATUS_CHANGE',
      from: oldStatus,
      to: targetStatus,
      remarks: changeReason,
      isVerified: Boolean(isVerified),
    });

    await employee.save();

    // Trigger exit clearance checklist if transitioning to notice, resigned, or terminated
    if (['notice', 'resigned', 'terminated'].includes(targetStatus)) {
      try {
        await initiateExitClearance(id);
      } catch (clearanceErr) {
        console.warn('Exit clearance initiation error:', clearanceErr.message);
      }
    }

    // If resigned or terminated or inactive, deactivate user
    if (['resigned', 'terminated', 'inactive'].includes(targetStatus)) {
      await User.updateOne({ employee: id }, { isActive: false });
    } else {
      await User.updateOne({ employee: id }, { isActive: true });
    }

    await logAudit({
      req,
      action: 'SET_EMPLOYMENT_STATUS',
      entity: 'Employee',
      entityId: id,
      changes: {
        from: oldStatus,
        to: targetStatus,
        confirmationDate: employee.employment.confirmationDate,
        reason: changeReason,
      },
    });

    // Automatically recalculate 2026 leave balances after status change
    try {
      const activePy =
        (await LeavePolicyYear.findOne({ isCurrent: true })) ||
        (await LeavePolicyYear.findOne().sort({ startDate: -1 }));
      if (activePy) {
        await recalculatePolicyYearBalances(activePy._id, { _id: employee._id });
      }
    } catch (recalcErr) {
      console.warn('Post-status recalculation warning:', recalcErr.message);
    }

    return sendSuccess(res, employee, `Employee status changed to ${targetStatus}`);
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

// GET /api/v1/employees/summary - Quick statistics for status chips
export const getEmployeeSummary = async (req, res, next) => {
  try {
    const [total, active, probation, notice, exited] = await Promise.all([
      Employee.countDocuments({ isDeleted: false }),
      Employee.countDocuments({ isDeleted: false, status: 'active' }),
      Employee.countDocuments({ isDeleted: false, status: 'probation' }),
      Employee.countDocuments({ isDeleted: false, status: 'notice' }),
      Employee.countDocuments({ isDeleted: false, status: { $in: ['resigned', 'terminated', 'inactive'] } }),
    ]);

    return sendSuccess(res, { total, active, probation, notice, exited }, 'Employee summary retrieved');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/employees/:id/lifecycle/:action - Execute lifecycle action
export const triggerLifecycleAction = async (req, res, next) => {
  try {
    const { id, action } = req.params;
    const { payload = {}, reason = '', effectiveDate = null } = req.body;

    const result = await executeLifecycleAction({
      employeeId: id,
      action,
      payload,
      performedByUserId: req.user._id,
      reason,
      effectiveDate,
    });

    await logAudit({
      req,
      action: `LIFECYCLE_${action.toUpperCase()}`,
      entity: 'Employee',
      entityId: id,
      changes: { action, reason, isScheduled: result.isScheduled },
    });

    return sendSuccess(res, result, `Lifecycle action ${action} executed successfully`);
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/employees/:id/reveal - Reveal masked sensitive statutory/bank field
export const revealSensitiveField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { field, reason } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, 'A justification reason is mandatory to reveal sensitive data', 400);
    }

    const employee = await Employee.findById(id);
    if (!employee) return sendError(res, 'Employee not found', 404);

    let revealedValue = '';
    if (field === 'aadhaar') revealedValue = employee.statutory?.aadhaar;
    else if (field === 'pan') revealedValue = employee.statutory?.pan;
    else if (field === 'uan') revealedValue = employee.statutory?.uan;
    else if (field === 'accountNumber') revealedValue = employee.bank?.accountNumber;
    else return sendError(res, 'Invalid sensitive field requested', 400);

    await logAudit({
      req,
      action: 'REVEAL_SENSITIVE_DATA',
      entity: 'Employee',
      entityId: id,
      changes: { field, reason },
    });

    return sendSuccess(res, { field, value: revealedValue }, 'Sensitive field revealed');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/employees/orgchart - Get hierarchy tree
export const getOrgChart = async (req, res, next) => {
  try {
    const data = await getOrgChartTree();
    return sendSuccess(res, data, 'Organization chart hierarchy retrieved');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/employees/data-quality - Audit missing data & duplicates
export const getDataQualityAudit = async (req, res, next) => {
  try {
    const audit = await auditEmployeeDataQuality();
    return sendSuccess(res, audit, 'Data quality audit completed');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/employees/me/profile-change - Self-service profile change request
export const submitProfileChangeRequest = async (req, res, next) => {
  try {
    const { updates = {}, reason = '' } = req.body;
    const empId = req.user.employee?._id;
    if (!empId) return sendError(res, 'No linked employee profile found', 400);

    const approval = await mongoose.model('ApprovalRequest').create({
      type: 'profile_change',
      referenceModel: 'Employee',
      referenceId: empId,
      requestedBy: empId,
      title: `Profile Update Request: ${Object.keys(updates).join(', ')}`,
      metadata: { updates, reason },
      steps: [
        { order: 1, approverRole: 'hr', title: 'HR Administration Review', status: 'pending' },
      ],
      currentStep: 1,
      status: 'pending',
    });

    return sendSuccess(res, approval, 'Profile change request submitted for HR approval');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/employees/bulk-action - Bulk change department, manager, or status
export const bulkEmployeeAction = async (req, res, next) => {
  try {
    const { action, ids = [], payload = {}, reason = '' } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'At least one employee must be selected', 400);
    }

    let updatedCount = 0;
    for (const empId of ids) {
      const emp = await Employee.findById(empId);
      if (!emp) continue;

      if (action === 'department' && payload.departmentId) {
        emp.employment.department = payload.departmentId;
        emp.history.push({ date: new Date(), type: 'BULK_DEPT_CHANGE', remarks: reason });
      } else if (action === 'manager' && payload.managerId) {
        emp.employment.reportingManager = payload.managerId;
        emp.history.push({ date: new Date(), type: 'BULK_MGR_CHANGE', remarks: reason });
      } else if (action === 'status' && payload.status) {
        emp.status = payload.status;
        emp.history.push({ date: new Date(), type: 'BULK_STATUS_CHANGE', to: payload.status, remarks: reason });
      }
      await emp.save();
      updatedCount++;
    }

    await logAudit({
      req,
      action: `BULK_EMPLOYEE_${(action || '').toUpperCase()}`,
      entity: 'Employee',
      changes: { action, count: updatedCount, reason },
    });

    return sendSuccess(res, { updatedCount }, `Bulk ${action} updated for ${updatedCount} employees`);
  } catch (err) {
    next(err);
  }
};

