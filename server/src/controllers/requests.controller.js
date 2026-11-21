import mongoose from 'mongoose';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveType } from '../models/LeaveType.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { PartialDayRequest } from '../models/PartialDayRequest.js';
import { CompOffRequest } from '../models/CompOffRequest.js';
import { CompOffCredit } from '../models/CompOffCredit.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Attendance } from '../models/Attendance.js';
import { Holiday } from '../models/Holiday.js';
import { Employee } from '../models/Employee.js';
import { createApprovalRequest } from '../services/approval.service.js';
import { handleWorkflowCompletion } from '../services/approvalHandlers.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Resolves target employee and verifies behalf-application permissions
 */
const resolveTargetEmployee = async (req) => {
  const targetId = req.body.employeeId || req.query.employeeId;
  const userEmpId = req.user.employee?._id;
  const userRole = req.userRole;

  if (!targetId || (userEmpId && String(targetId) === String(userEmpId))) {
    if (!userEmpId) throw new Error('No employee profile linked to user account');
    return { employeeId: userEmpId, isOnBehalf: false };
  }

  // Target is different from logged in user -> Check if HR, Super Admin, or direct Reporting Manager
  if (['super_admin', 'hr'].includes(userRole)) {
    return { employeeId: targetId, isOnBehalf: true };
  }

  // Manager check
  const targetEmp = await Employee.findById(targetId);
  if (!targetEmp) throw new Error('Target employee not found');

  const managerId = targetEmp.employment?.reportingManager;
  if (userEmpId && managerId && String(managerId) === String(userEmpId)) {
    return { employeeId: targetId, isOnBehalf: true };
  }

  const err = new Error('You do not have permission to apply or view requests on behalf of this employee');
  err.statusCode = 403;
  throw err;
};

/**
 * Checks overlap with existing active leaves, remote work, or partial days
 */
export const checkOverlap = async ({ employeeId, fromDate, toDate, excludeType = null, excludeId = null }) => {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  // Check LeaveRequest
  const leaveQuery = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    fromDate: { $lte: end },
    toDate: { $gte: start },
  };
  if (excludeType === 'leave' && excludeId) leaveQuery._id = { $ne: excludeId };
  const overlappingLeave = await LeaveRequest.findOne(leaveQuery).populate('leaveType', 'name');
  if (overlappingLeave) {
    return `Overlaps with an existing ${overlappingLeave.status} Leave Request (${overlappingLeave.leaveType?.name || 'Leave'})`;
  }

  // Check RemoteWorkRequest
  const rwQuery = {
    employee: employeeId,
    status: { $in: ['pending', 'approved'] },
    fromDate: { $lte: end },
    toDate: { $gte: start },
  };
  if (excludeType === 'remote_work' && excludeId) rwQuery._id = { $ne: excludeId };
  const overlappingRw = await RemoteWorkRequest.findOne(rwQuery);
  if (overlappingRw) {
    return `Overlaps with an existing ${overlappingRw.status} Remote Work (WFH) Request`;
  }

  return null;
};

/**
 * Calculates billable days between two dates, skipping Sundays and holidays
 */
export const calculateBillableDays = async (fromDate, toDate) => {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  const holidays = await Holiday.find({
    date: { $gte: start, $lte: end },
  });
  const holidayDates = new Set(holidays.map((h) => new Date(h.date).toDateString()));

  let workingDaysCount = 0;
  let sundayCount = 0;
  let holidayCount = 0;

  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    const dateStr = cur.toDateString();

    if (day === 0) {
      sundayCount += 1;
    } else if (holidayDates.has(dateStr)) {
      holidayCount += 1;
    } else {
      workingDaysCount += 1;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return { workingDaysCount, sundayCount, holidayCount };
};

// ==========================================
// 1. LOG REGULARIZATION (Page 2)
// ==========================================
export const getRegularizationRequests = async (req, res, next) => {
  try {
    const { status, employeeId, startDate, endDate } = req.query;
    const userRole = req.userRole;
    const userEmpId = req.user.employee?._id;

    const filter = {};
    if (status && status !== 'all') filter.status = status;

    if (employeeId) {
      if (!['super_admin', 'hr'].includes(userRole) && String(employeeId) !== String(userEmpId)) {
        // Verify manager
        const target = await Employee.findById(employeeId);
        if (String(target?.employment?.reportingManager) !== String(userEmpId)) {
          return sendError(res, 'Access denied to this employee records', 403);
        }
      }
      filter.employee = employeeId;
    } else if (!['super_admin', 'hr'].includes(userRole)) {
      filter.employee = userEmpId;
    }

    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const requests = await AttendanceRegularization.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('appliedBy', 'email')
      .populate({
        path: 'approvalRequest',
        populate: [
          { path: 'steps.approverEmployee', select: 'personal.firstName personal.lastName employeeId' },
          { path: 'steps.actedBy', select: 'email' },
        ],
      })
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'Regularization requests retrieved');
  } catch (err) {
    next(err);
  }
};

export const applyRegularizationRequest = async (req, res, next) => {
  try {
    const { date, punchType = 'in', requestedTime, reason, employeeId: targetId } = req.body;
    const { employeeId, isOnBehalf } = await resolveTargetEmployee(req);

    if (!date || !reason) {
      return sendError(res, 'Date and reason are required', 400);
    }

    const reqDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (reqDate > today) {
      return sendError(res, 'Regularization cannot be requested for future dates', 400);
    }

    // 15 days backdate limit
    const diffDays = Math.floor((today - reqDate) / (1000 * 60 * 60 * 24));
    if (diffDays > 15) {
      return sendError(res, 'Regularization cannot be requested beyond 15 days back', 400);
    }

    // Check duplicate pending regularization
    const startOfDay = new Date(reqDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reqDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingPending = await AttendanceRegularization.findOne({
      employee: employeeId,
      punchType,
      date: { $gte: startOfDay, $lte: endOfDay },
      status: 'pending',
    });

    if (existingPending) {
      return sendError(res, `A pending regularization request already exists for ${punchType.toUpperCase()} punch on this date`, 400);
    }

    const punchDateTime = requestedTime ? new Date(requestedTime) : new Date(date);

    const reg = await AttendanceRegularization.create({
      employee: employeeId,
      date: startOfDay,
      punchType,
      requestedTime: punchDateTime,
      requestedCheckIn: punchType === 'in' ? punchDateTime : null,
      requestedCheckOut: punchType === 'out' ? punchDateTime : null,
      reason,
      status: 'pending',
      appliedBy: isOnBehalf ? req.user._id : null,
    });

    const emp = await Employee.findById(employeeId);
    const title = `Log Regularization (${punchType.toUpperCase()}) - ${new Date(date).toLocaleDateString('en-IN')}`;

    const approval = await createApprovalRequest({
      type: 'regularization',
      referenceModel: 'AttendanceRegularization',
      referenceId: reg._id,
      requestedByEmployeeId: employeeId,
      requesterUserId: req.user._id,
      title,
      metadata: {
        punchType,
        date: startOfDay,
        requestedTime: punchDateTime,
        employeeName: `${emp?.personal?.firstName} ${emp?.personal?.lastName}`,
        appliedOnBehalf: isOnBehalf,
        appliedByName: req.user.email,
      },
    });

    reg.approvalRequest = approval._id;
    await reg.save();

    return sendSuccess(res, reg, 'Regularization request submitted successfully', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// ==========================================
// 2. APPLY LEAVE (Page 3)
// ==========================================
export const getLeaveRequests = async (req, res, next) => {
  try {
    const { status, employeeId, startDate, endDate } = req.query;
    const userRole = req.userRole;
    const userEmpId = req.user.employee?._id;

    const filter = {};
    if (status && status !== 'all') filter.status = status;

    if (employeeId) {
      if (!['super_admin', 'hr'].includes(userRole) && String(employeeId) !== String(userEmpId)) {
        const target = await Employee.findById(employeeId);
        if (String(target?.employment?.reportingManager) !== String(userEmpId)) {
          return sendError(res, 'Access denied to this employee records', 403);
        }
      }
      filter.employee = employeeId;
    } else if (!['super_admin', 'hr'].includes(userRole)) {
      filter.employee = userEmpId;
    }

    if (startDate && endDate) {
      filter.fromDate = { $gte: new Date(startDate) };
      filter.toDate = { $lte: new Date(endDate) };
    }

    const requests = await LeaveRequest.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('leaveType', 'name code paid requiresDocument allowHalfDay')
      .populate('appliedBy', 'email')
      .populate({
        path: 'approvalRequest',
        populate: [
          { path: 'steps.approverEmployee', select: 'personal.firstName personal.lastName employeeId' },
          { path: 'steps.actedBy', select: 'email' },
        ],
      })
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'Leave requests retrieved');
  } catch (err) {
    next(err);
  }
};

export const applyLeaveRequest = async (req, res, next) => {
  try {
    const { leaveTypeId, fromDate, toDate, isHalfDay = false, reason, document = {} } = req.body;
    const { employeeId, isOnBehalf } = await resolveTargetEmployee(req);

    if (!leaveTypeId || !fromDate || !toDate || !reason) {
      return sendError(res, 'Leave type, fromDate, toDate, and reason are required', 400);
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (start > end) {
      return sendError(res, 'Start date cannot be after end date', 400);
    }

    // Overlap check
    const overlapErr = await checkOverlap({ employeeId, fromDate, toDate, excludeType: 'leave' });
    if (overlapErr) {
      return sendError(res, overlapErr, 400);
    }

    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) {
      return sendError(res, 'Invalid leave type selected', 404);
    }

    // Compute billable days (skips Sundays and holidays)
    const { workingDaysCount } = await calculateBillableDays(start, end);
    if (workingDaysCount === 0) {
      return sendError(res, 'The selected date range contains only Sundays or company holidays', 400);
    }

    const calculatedDays = isHalfDay ? 0.5 : workingDaysCount;
    const calculatedMinutes = isHalfDay ? 240 : workingDaysCount * 465;

    // Sick leave document check
    if ((leaveType.code === 'SL' && calculatedDays > 2) || (leaveType.requiresDocument && !document?.url)) {
      if (!document?.url) {
        return sendError(res, 'A medical certificate or document attachment is mandatory for this leave request', 400);
      }
    }

    // Balance check
    const currentYear = start.getFullYear();
    if (leaveType.code === 'COMP_OFF') {
      // Check active unexpired CompOffCredit
      const activeCredits = await CompOffCredit.find({
        employee: employeeId,
        status: 'active',
        expiresAt: { $gte: new Date() },
      });
      const totalAvailableMinutes = activeCredits.reduce(
        (sum, c) => sum + (c.creditMinutes - c.usedMinutes),
        0
      );

      if (totalAvailableMinutes < calculatedMinutes) {
        return sendError(
          res,
          `Insufficient comp-off credit balance. Available: ${(totalAvailableMinutes / 60).toFixed(1)} hrs, Requested: ${(calculatedMinutes / 60).toFixed(1)} hrs`,
          400
        );
      }
    } else {
      let balance = await LeaveBalance.findOne({
        employee: employeeId,
        leaveType: leaveTypeId,
        year: currentYear,
      });

      if (!balance) {
        balance = await LeaveBalance.create({
          employee: employeeId,
          leaveType: leaveTypeId,
          year: currentYear,
          allocated: leaveType.yearlyQuota || 0,
          pending: 0,
          used: 0,
        });
      }

      const available = (balance.allocated + balance.carried) - (balance.used + balance.pending);
      if (leaveType.paid && available < calculatedDays) {
        return sendError(res, `Insufficient leave quota. Available balance: ${available} days, Requested: ${calculatedDays} days`, 400);
      }

      // Reserve pending quota
      balance.pending += calculatedDays;
      await balance.save();
    }

    const leave = await LeaveRequest.create({
      employee: employeeId,
      leaveType: leaveTypeId,
      fromDate: start,
      toDate: end,
      isHalfDay,
      days: calculatedDays,
      minutes: calculatedMinutes,
      reason,
      document,
      status: 'pending',
      appliedBy: isOnBehalf ? req.user._id : null,
    });

    const emp = await Employee.findById(employeeId);
    const title = `${leaveType.name} Application (${calculatedDays} ${calculatedDays === 1 ? 'day' : 'days'})`;

    const approval = await createApprovalRequest({
      type: 'leave',
      referenceModel: 'LeaveRequest',
      referenceId: leave._id,
      requestedByEmployeeId: employeeId,
      requesterUserId: req.user._id,
      title,
      metadata: {
        leaveTypeName: leaveType.name,
        days: calculatedDays,
        minutes: calculatedMinutes,
        fromDate: start,
        toDate: end,
        employeeName: `${emp?.personal?.firstName} ${emp?.personal?.lastName}`,
        appliedOnBehalf: isOnBehalf,
        appliedByName: req.user.email,
      },
    });

    leave.approvalRequest = approval._id;
    await leave.save();

    return sendSuccess(res, leave, 'Leave application submitted successfully', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getLeaveBalances = async (req, res, next) => {
  try {
    const { employeeId: targetId } = req.query;
    const { employeeId } = await resolveTargetEmployee(req);
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const types = await LeaveType.find({ isActive: true });
    const balances = await LeaveBalance.find({ employee: employeeId, year }).populate('leaveType');

    // Also get active comp-off credit balance
    const activeCredits = await CompOffCredit.find({
      employee: employeeId,
      status: 'active',
      expiresAt: { $gte: new Date() },
    });
    const totalCompOffMinutes = activeCredits.reduce(
      (sum, c) => sum + (c.creditMinutes - c.usedMinutes),
      0
    );

    const result = types.map((type) => {
      if (type.code === 'COMP_OFF') {
        const days = parseFloat((totalCompOffMinutes / 465).toFixed(2));
        return {
          leaveType: type,
          year,
          allocated: days,
          carried: 0,
          used: 0,
          pending: 0,
          available: days,
          availableMinutes: totalCompOffMinutes,
        };
      }

      const bal = balances.find((b) => String(b.leaveType?._id) === String(type._id));
      const allocated = bal?.allocated || type.yearlyQuota || 0;
      const carried = bal?.carried || 0;
      const used = bal?.used || 0;
      const pending = bal?.pending || 0;
      const available = Math.max(0, (allocated + carried) - (used + pending));

      return {
        leaveType: type,
        year,
        allocated,
        carried,
        used,
        pending,
        available,
        availableMinutes: available * 465,
      };
    });

    return sendSuccess(res, result, 'Leave balances retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// ==========================================
// 3. APPLY REMOTE WORK (Page 4)
// ==========================================
export const getRemoteWorkRequests = async (req, res, next) => {
  try {
    const { status, employeeId, startDate, endDate } = req.query;
    const userRole = req.userRole;
    const userEmpId = req.user.employee?._id;

    const filter = {};
    if (status && status !== 'all') filter.status = status;

    if (employeeId) {
      if (!['super_admin', 'hr'].includes(userRole) && String(employeeId) !== String(userEmpId)) {
        const target = await Employee.findById(employeeId);
        if (String(target?.employment?.reportingManager) !== String(userEmpId)) {
          return sendError(res, 'Access denied to this employee records', 403);
        }
      }
      filter.employee = employeeId;
    } else if (!['super_admin', 'hr'].includes(userRole)) {
      filter.employee = userEmpId;
    }

    if (startDate && endDate) {
      filter.fromDate = { $gte: new Date(startDate) };
      filter.toDate = { $lte: new Date(endDate) };
    }

    const requests = await RemoteWorkRequest.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('appliedBy', 'email')
      .populate({
        path: 'approvalRequest',
        populate: [
          { path: 'steps.approverEmployee', select: 'personal.firstName personal.lastName employeeId' },
          { path: 'steps.actedBy', select: 'email' },
        ],
      })
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'Remote work requests retrieved');
  } catch (err) {
    next(err);
  }
};

export const applyRemoteWorkRequest = async (req, res, next) => {
  try {
    const { fromDate, toDate, reason, contactPhone = '' } = req.body;
    const { employeeId, isOnBehalf } = await resolveTargetEmployee(req);

    if (!fromDate || !toDate || !reason) {
      return sendError(res, 'Start date, end date, and reason are required', 400);
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (start > end) {
      return sendError(res, 'Start date cannot be after end date', 400);
    }

    const overlapErr = await checkOverlap({ employeeId, fromDate, toDate, excludeType: 'remote_work' });
    if (overlapErr) {
      return sendError(res, overlapErr, 400);
    }

    const { workingDaysCount } = await calculateBillableDays(start, end);
    if (workingDaysCount === 0) {
      return sendError(res, 'The selected dates contain only Sundays or company holidays', 400);
    }

    const remoteWork = await RemoteWorkRequest.create({
      employee: employeeId,
      fromDate: start,
      toDate: end,
      days: workingDaysCount,
      reason,
      contactPhone,
      status: 'pending',
      appliedBy: isOnBehalf ? req.user._id : null,
    });

    const emp = await Employee.findById(employeeId);
    const title = `Remote Work (WFH) - ${workingDaysCount} ${workingDaysCount === 1 ? 'day' : 'days'}`;

    const approval = await createApprovalRequest({
      type: 'remote_work',
      referenceModel: 'RemoteWorkRequest',
      referenceId: remoteWork._id,
      requestedByEmployeeId: employeeId,
      requesterUserId: req.user._id,
      title,
      metadata: {
        fromDate: start,
        toDate: end,
        days: workingDaysCount,
        contactPhone,
        employeeName: `${emp?.personal?.firstName} ${emp?.personal?.lastName}`,
        appliedOnBehalf: isOnBehalf,
        appliedByName: req.user.email,
      },
    });

    remoteWork.approvalRequest = approval._id;
    await remoteWork.save();

    return sendSuccess(res, remoteWork, 'Remote work request submitted successfully', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// ==========================================
// 4. APPLY PARTIAL DAY (Page 5)
// ==========================================
export const getPartialDayRequests = async (req, res, next) => {
  try {
    const { status, employeeId, startDate, endDate } = req.query;
    const userRole = req.userRole;
    const userEmpId = req.user.employee?._id;

    const filter = {};
    if (status && status !== 'all') filter.status = status;

    if (employeeId) {
      if (!['super_admin', 'hr'].includes(userRole) && String(employeeId) !== String(userEmpId)) {
        const target = await Employee.findById(employeeId);
        if (String(target?.employment?.reportingManager) !== String(userEmpId)) {
          return sendError(res, 'Access denied to this employee records', 403);
        }
      }
      filter.employee = employeeId;
    } else if (!['super_admin', 'hr'].includes(userRole)) {
      filter.employee = userEmpId;
    }

    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const requests = await PartialDayRequest.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('appliedBy', 'email')
      .populate({
        path: 'approvalRequest',
        populate: [
          { path: 'steps.approverEmployee', select: 'personal.firstName personal.lastName employeeId' },
          { path: 'steps.actedBy', select: 'email' },
        ],
      })
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'Partial day requests retrieved');
  } catch (err) {
    next(err);
  }
};

export const applyPartialDayRequest = async (req, res, next) => {
  try {
    const { date, type, minutes, reason } = req.body;
    const { employeeId, isOnBehalf } = await resolveTargetEmployee(req);

    if (!date || !type || !minutes || !reason) {
      return sendError(res, 'Date, type, minutes, and reason are required', 400);
    }

    if (!['late_coming', 'early_leaving', 'short_leave'].includes(type)) {
      return sendError(res, 'Type must be late_coming, early_leaving, or short_leave', 400);
    }

    const reqMinutes = parseInt(minutes, 10);
    if (isNaN(reqMinutes) || reqMinutes < 15 || reqMinutes > 240) {
      return sendError(res, 'Minutes must be between 15 and 240 minutes (max 4 hrs)', 400);
    }

    const targetDate = new Date(date);
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Monthly policy cap: max 3 requests per month
    const monthlyCount = await PartialDayRequest.countDocuments({
      employee: employeeId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      status: { $in: ['pending', 'approved'] },
    });

    if (monthlyCount >= 3) {
      return sendError(
        res,
        'Monthly partial-day policy limit reached (maximum 3 requests allowed per calendar month)',
        400
      );
    }

    const partialDay = await PartialDayRequest.create({
      employee: employeeId,
      date: targetDate,
      type,
      minutes: reqMinutes,
      reason,
      status: 'pending',
      appliedBy: isOnBehalf ? req.user._id : null,
    });

    const emp = await Employee.findById(employeeId);
    const typeLabel = type === 'late_coming' ? 'Late Coming' : type === 'early_leaving' ? 'Early Leaving' : 'Short Leave';
    const title = `Partial Day (${typeLabel}) - ${reqMinutes}m on ${targetDate.toLocaleDateString('en-IN')}`;

    const approval = await createApprovalRequest({
      type: 'partial_day',
      referenceModel: 'PartialDayRequest',
      referenceId: partialDay._id,
      requestedByEmployeeId: employeeId,
      requesterUserId: req.user._id,
      title,
      metadata: {
        date: targetDate,
        type,
        minutes: reqMinutes,
        employeeName: `${emp?.personal?.firstName} ${emp?.personal?.lastName}`,
        appliedOnBehalf: isOnBehalf,
        appliedByName: req.user.email,
      },
    });

    partialDay.approvalRequest = approval._id;
    await partialDay.save();

    return sendSuccess(res, partialDay, 'Partial day request submitted successfully', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

// ==========================================
// 5. COMP-OFF CREDITS (Page 6)
// ==========================================
export const getCompOffRequests = async (req, res, next) => {
  try {
    const { status, employeeId } = req.query;
    const userRole = req.userRole;
    const userEmpId = req.user.employee?._id;

    const filter = {};
    if (status && status !== 'all') filter.status = status;

    if (employeeId) {
      if (!['super_admin', 'hr'].includes(userRole) && String(employeeId) !== String(userEmpId)) {
        const target = await Employee.findById(employeeId);
        if (String(target?.employment?.reportingManager) !== String(userEmpId)) {
          return sendError(res, 'Access denied to this employee records', 403);
        }
      }
      filter.employee = employeeId;
    } else if (!['super_admin', 'hr'].includes(userRole)) {
      filter.employee = userEmpId;
    }

    const requests = await CompOffRequest.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('appliedBy', 'email')
      .populate({
        path: 'approvalRequest',
        populate: [
          { path: 'steps.approverEmployee', select: 'personal.firstName personal.lastName employeeId' },
          { path: 'steps.actedBy', select: 'email' },
        ],
      })
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'Comp-off requests retrieved');
  } catch (err) {
    next(err);
  }
};

export const getCompOffCredits = async (req, res, next) => {
  try {
    const { employeeId } = await resolveTargetEmployee(req);

    const credits = await CompOffCredit.find({ employee: employeeId })
      .populate('compOffRequest', 'workedDate reason')
      .sort({ earnedDate: -1 });

    const totalActiveMinutes = credits
      .filter((c) => c.status === 'active' && new Date(c.expiresAt) >= new Date())
      .reduce((sum, c) => sum + (c.creditMinutes - c.usedMinutes), 0);

    return sendSuccess(
      res,
      {
        credits,
        summary: {
          activeDays: parseFloat((totalActiveMinutes / 465).toFixed(2)),
          activeMinutes: totalActiveMinutes,
          totalEarned: credits.length,
          expiredCount: credits.filter((c) => c.status === 'expired').length,
        },
      },
      'Comp-off credit ledger retrieved'
    );
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const verifyWorkedPresence = async (req, res, next) => {
  try {
    const { workedDate, employeeId: targetId } = req.query;
    const { employeeId } = await resolveTargetEmployee(req);

    if (!workedDate) return sendError(res, 'workedDate is required', 400);

    const date = new Date(workedDate);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const isSunday = date.getDay() === 0;
    const holiday = await Holiday.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!isSunday && !holiday) {
      return sendSuccess(res, {
        eligible: false,
        reason: 'Comp-off can only be claimed for working on a Sunday or recognized company holiday.',
        isSunday,
        isHoliday: false,
        workedMinutes: 0,
      });
    }

    // Check biometric logs or attendance records for presence
    const logs = await AttendanceLog.find({
      employee: employeeId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ timestamp: 1 });

    let workedMinutes = 0;
    let inTime = null;
    for (const log of logs) {
      if (log.punchType === 'in' && !inTime) {
        inTime = new Date(log.timestamp);
      } else if (log.punchType === 'out' && inTime) {
        const diff = Math.floor((new Date(log.timestamp) - inTime) / (1000 * 60));
        workedMinutes += Math.max(0, diff);
        inTime = null;
      }
    }

    // Fallback to legacy Attendance model
    if (workedMinutes === 0) {
      const att = await Attendance.findOne({
        employee: employeeId,
        date: { $gte: startOfDay, $lte: endOfDay },
      });
      if (att && att.workHours > 0) {
        workedMinutes = Math.round(att.workHours * 60);
      }
    }

    const eligible = workedMinutes >= 240; // At least 4 hours
    return sendSuccess(res, {
      eligible,
      isSunday,
      isHoliday: !!holiday,
      holidayName: holiday?.name || null,
      workedMinutes,
      workedHours: parseFloat((workedMinutes / 60).toFixed(1)),
      reason: eligible
        ? 'Verified: You have >= 4 hours worked on this holiday/week-off.'
        : `Insufficient presence: Found ${(workedMinutes / 60).toFixed(1)} hrs. Minimum 4.0 hrs required for comp-off claim.`,
    });
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const applyCompOffRequest = async (req, res, next) => {
  try {
    const { workedDate, reason } = req.body;
    const { employeeId, isOnBehalf } = await resolveTargetEmployee(req);

    if (!workedDate || !reason) {
      return sendError(res, 'Worked date and reason are required', 400);
    }

    const date = new Date(workedDate);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const isSunday = date.getDay() === 0;
    const holiday = await Holiday.findOne({
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!isSunday && !holiday) {
      return sendError(res, 'Comp-off can only be claimed for working on Sundays or recognized company holidays', 400);
    }

    // Check duplicate request
    const existing = await CompOffRequest.findOne({
      employee: employeeId,
      workedDate: { $gte: startOfDay, $lte: endOfDay },
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) {
      return sendError(res, `A comp-off request for this date already exists and is ${existing.status}`, 400);
    }

    // Verify worked hours >= 240m
    const logs = await AttendanceLog.find({
      employee: employeeId,
      timestamp: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ timestamp: 1 });

    let workedMinutes = 0;
    let inTime = null;
    for (const log of logs) {
      if (log.punchType === 'in' && !inTime) {
        inTime = new Date(log.timestamp);
      } else if (log.punchType === 'out' && inTime) {
        const diff = Math.floor((new Date(log.timestamp) - inTime) / (1000 * 60));
        workedMinutes += Math.max(0, diff);
        inTime = null;
      }
    }

    if (workedMinutes === 0) {
      const att = await Attendance.findOne({
        employee: employeeId,
        date: { $gte: startOfDay, $lte: endOfDay },
      });
      if (att && att.workHours > 0) {
        workedMinutes = Math.round(att.workHours * 60);
      }
    }

    if (workedMinutes < 240) {
      return sendError(
        res,
        `Cannot claim comp-off: Minimum 4.0 hours (240 minutes) of verified attendance required. Recorded: ${(workedMinutes / 60).toFixed(1)} hrs`,
        400
      );
    }

    const creditMinutes = workedMinutes >= 420 ? 465 : 240; // Full day if >= 7h, else half day
    const creditDays = creditMinutes === 465 ? 1 : 0.5;

    const compOff = await CompOffRequest.create({
      employee: employeeId,
      workedDate: startOfDay,
      workedMinutes,
      creditMinutes,
      creditDays,
      reason,
      status: 'pending',
      appliedBy: isOnBehalf ? req.user._id : null,
    });

    const emp = await Employee.findById(employeeId);
    const title = `Comp-Off Credit Claim (${creditDays} day) - ${startOfDay.toLocaleDateString('en-IN')}`;

    const approval = await createApprovalRequest({
      type: 'comp_off',
      referenceModel: 'CompOffRequest',
      referenceId: compOff._id,
      requestedByEmployeeId: employeeId,
      requesterUserId: req.user._id,
      title,
      metadata: {
        workedDate: startOfDay,
        workedMinutes,
        creditDays,
        creditMinutes,
        employeeName: `${emp?.personal?.firstName} ${emp?.personal?.lastName}`,
        appliedOnBehalf: isOnBehalf,
        appliedByName: req.user.email,
      },
    });

    compOff.approvalRequest = approval._id;
    await compOff.save();

    return sendSuccess(res, compOff, 'Comp-off credit claim submitted successfully', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};
