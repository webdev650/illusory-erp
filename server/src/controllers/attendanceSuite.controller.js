import { z } from 'zod';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { ClockInIntent } from '../models/ClockInIntent.js';
import { LateReasonOption } from '../models/LateReasonOption.js';
import {
  calculateDayStatus,
  getEmployeeMonthDayStatuses,
  recordPunch,
  getCompanyPolicy,
  toISTDateString,
} from '../services/dayStatus.service.js';
import {
  initiateClockIn,
  submitLateClockIn,
  getActiveLateReasons,
} from '../services/clockIn.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import { exportToExcel, exportToCsv } from '../services/export.service.js';

/**
 * GET /api/v1/attendance/calendar
 * Query: employeeId (optional), month (1-12), year (e.g. 2026), scope (self | all | team)
 */
export const getAttendanceCalendar = async (req, res, next) => {
  try {
    const now = new Date();
    const currentYear = parseInt(req.query.year, 10) || now.getFullYear();
    const currentMonth = parseInt(req.query.month, 10) || now.getMonth() + 1;
    const scope = req.query.scope || 'self';

    let targetEmployeeId = req.query.employeeId;

    // Self scope defaults to user's linked employee
    if (scope === 'self' || !targetEmployeeId) {
      if (!targetEmployeeId) {
        targetEmployeeId = req.user.employee?._id || req.user.employee;
      }
    }

    if (!targetEmployeeId) {
      return sendError(res, 'No employee record found or specified', 400);
    }

    // RBAC check: non-HR / non-Admin can only view self or their reporting team
    const isHRAdmin = req.userRole === 'super_admin' || req.userRole === 'hr';
    if (!isHRAdmin && String(targetEmployeeId) !== String(req.user.employee?._id || req.user.employee)) {
      // Check if target reports to this user
      const targetEmp = await Employee.findById(targetEmployeeId);
      const myEmpId = String(req.user.employee?._id || req.user.employee);
      if (String(targetEmp?.employment?.reportingManager) !== myEmpId) {
        return sendError(res, 'Access denied. You can only view your own or team member attendance.', 403);
      }
    }

    const data = await getEmployeeMonthDayStatuses(targetEmployeeId, currentYear, currentMonth);

    // Get employee profile
    const employee = await Employee.findById(targetEmployeeId, 'employeeId personal employment status');

    return sendSuccess(res, {
      employee,
      ...data,
    }, 'Attendance calendar data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/attendance/calendar/day
 * Query: employeeId, date (YYYY-MM-DD)
 */
export const getDayDetails = async (req, res, next) => {
  try {
    const employeeId = req.query.employeeId || req.user.employee?._id || req.user.employee;
    const dateStr = req.query.date || toISTDateString(new Date());

    if (!employeeId) {
      return sendError(res, 'Employee ID is required', 400);
    }

    const dayStatus = await calculateDayStatus(employeeId, dateStr);
    return sendSuccess(res, dayStatus, 'Day status retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/attendance/manage-logs
 * For HR / Admin / Managers to manage raw punches and review daily logs
 * Query: employeeId, month, year
 */
export const getManageLogs = async (req, res, next) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

    let employeeId = req.query.employeeId;
    if (!employeeId) {
      // Default to first active employee if HR/Admin, or self
      if (req.userRole === 'super_admin' || req.userRole === 'hr') {
        const first = await Employee.findOne({ isDeleted: false }).sort({ employeeId: 1 });
        employeeId = first?._id;
      } else {
        employeeId = req.user.employee?._id || req.user.employee;
      }
    }

    if (!employeeId) {
      return sendError(res, 'Employee ID is required', 400);
    }

    const employee = await Employee.findById(employeeId, 'employeeId personal employment status');
    const data = await getEmployeeMonthDayStatuses(employeeId, year, month);

    return sendSuccess(res, {
      employee,
      ...data,
    }, 'Manage logs data retrieved successfully');
  } catch (error) {
    next(error);
  }
};

const addPunchSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  type: z.enum(['in', 'out', 'break_in', 'break_out']),
  time: z.string().min(1, 'Punch time is required'), // ISO or HH:mm
  note: z.string().min(1, 'Reason or note is required for manual punch modifications'),
});

/**
 * POST /api/v1/attendance/logs
 * HR / Admin manually creates a punch
 */
export const addManualPunch = async (req, res, next) => {
  try {
    const { employeeId, date, type, time, note } = addPunchSchema.parse(req.body);

    let punchDateTime;
    if (time.includes('T')) {
      punchDateTime = new Date(time);
    } else {
      // Formatted as HH:mm -> compose into IST ISO
      punchDateTime = new Date(`${date}T${time}:00+05:30`);
    }

    const result = await recordPunch({
      employeeId,
      type,
      time: punchDateTime,
      source: 'manual',
      note,
      changedBy: req.user._id,
    });

    await logAudit({
      req,
      action: 'MANUAL_PUNCH_ADDED',
      entity: 'AttendanceLog',
      entityId: result.log._id,
      changes: { employeeId, date, type, time: punchDateTime, note },
    });

    return sendSuccess(res, result, 'Manual punch added successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/attendance/logs/:id
 * Edit punch time or note
 */
export const updateManualPunch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { time, note } = req.body;

    if (!note) {
      return sendError(res, 'Reason is mandatory when editing attendance punches', 400);
    }

    const log = await AttendanceLog.findById(id);
    if (!log) {
      return sendError(res, 'Punch record not found', 404);
    }

    const previousTime = log.time;
    if (time) log.time = new Date(time);
    log.note = `${log.note ? log.note + ' | ' : ''}Edited: ${note}`;
    log.source = 'manual';
    log.changedBy = req.user._id;
    await log.save();

    // Re-trigger day status calculation
    const dayStatus = await calculateDayStatus(log.employee, log.date);

    await logAudit({
      req,
      action: 'MANUAL_PUNCH_EDITED',
      entity: 'AttendanceLog',
      entityId: id,
      changes: { previousTime, newTime: log.time, note },
    });

    return sendSuccess(res, { log, dayStatus }, 'Punch updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/attendance/logs/:id
 * Soft-delete punch
 */
export const deleteManualPunch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return sendError(res, 'Reason is required to delete a punch record', 400);
    }

    const log = await AttendanceLog.findById(id);
    if (!log) {
      return sendError(res, 'Punch record not found', 404);
    }

    log.isDeleted = true;
    log.note = `${log.note ? log.note + ' | ' : ''}Deleted: ${reason}`;
    log.changedBy = req.user._id;
    await log.save();

    const dayStatus = await calculateDayStatus(log.employee, log.date);

    await logAudit({
      req,
      action: 'MANUAL_PUNCH_DELETED',
      entity: 'AttendanceLog',
      entityId: id,
      changes: { reason },
    });

    return sendSuccess(res, { log, dayStatus }, 'Punch deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/attendance/punch
 * Web self-service punch (check-in, check-out, break-in, break-out)
 */
export const recordSelfPunch = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id || req.user.employee;
    if (!employeeId) {
      return sendError(res, 'No linked employee record found for your user account', 400);
    }

    const { type, note } = req.body;
    if (!['in', 'out', 'break_in', 'break_out'].includes(type)) {
      return sendError(res, 'Invalid punch type. Must be in, out, break_in, or break_out.', 400);
    }

    // Special logic for Clock In ('in'): check policy lateness window and intent
    if (type === 'in') {
      try {
        const result = await initiateClockIn({
          employeeId,
          userId: req.user._id,
          req,
        });
        return sendSuccess(res, result, 'Clocked in successfully');
      } catch (err) {
        if (err.statusCode === 409 && err.code === 'LATE_REASON_REQUIRED') {
          return res.status(409).json({
            success: false,
            code: 'LATE_REASON_REQUIRED',
            message: err.message,
            data: err.data,
          });
        }
        throw err;
      }
    }

    // For other punches ('out', 'break_in', 'break_out'): record directly
    const result = await recordPunch({
      employeeId,
      type,
      time: new Date(),
      source: 'web',
      note: note || '',
      changedBy: req.user._id,
    });

    return sendSuccess(res, result, `Recorded ${type.toUpperCase()} punch successfully`);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/attendance/punch/late-reason
 * Submits the selected late reason and note using the frozen server time from ClockInIntent.
 */
export const submitLateReasonPunch = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id || req.user.employee;
    if (!employeeId) {
      return sendError(res, 'No linked employee record found for your user account', 400);
    }

    const { intentId, reasonKey, note } = req.body;
    if (!intentId || !reasonKey) {
      return sendError(res, 'intentId and reasonKey are required', 400);
    }

    const result = await submitLateClockIn({
      intentId,
      reasonKey,
      note,
      userId: req.user._id,
      req,
    });

    return sendSuccess(res, result, 'Clocked in successfully with recorded late reason');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/attendance/punch/intent/:intentId
 * Cancels a late clock-in intent leaving employee not clocked in.
 */
export const cancelClockInIntent = async (req, res, next) => {
  try {
    const { intentId } = req.params;
    await ClockInIntent.deleteOne({ intentId });
    return sendSuccess(res, null, 'Clock-in cancelled');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/attendance/late-reasons
 * Retrieves list of active late reasons for the clock-in popup.
 */
export const getLateReasons = async (req, res, next) => {
  try {
    const reasons = await getActiveLateReasons();
    return sendSuccess(res, reasons, 'Late reasons retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/attendance/late-reasons/:key
 * HR / Admin endpoint to edit late reason properties (label, emoji, requiresNote, order, isActive).
 */
export const updateLateReason = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { label, emoji, requiresNote, order, isActive } = req.body;

    const reason = await LateReasonOption.findOneAndUpdate(
      { key },
      { $set: { label, emoji, requiresNote, order, isActive } },
      { new: true, upsert: true }
    );

    await logAudit({
      req,
      action: 'UPDATE_LATE_REASON_OPTION',
      entity: 'LateReasonOption',
      entityId: reason._id,
      changes: req.body,
    });

    return sendSuccess(res, reason, 'Late reason option updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/attendance/policy
 */
export const getPolicy = async (req, res, next) => {
  try {
    const policy = await getCompanyPolicy();
    return sendSuccess(res, policy, 'Attendance policy retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/v1/attendance/policy
 */
export const updatePolicy = async (req, res, next) => {
  try {
    const policy = await getCompanyPolicy();
    Object.assign(policy, req.body);
    await policy.save();

    await logAudit({
      req,
      action: 'UPDATE_ATTENDANCE_POLICY',
      entity: 'AttendancePolicy',
      entityId: policy._id,
      changes: req.body,
    });

    return sendSuccess(res, policy, 'Attendance policy updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/attendance/export
 * Export calendar or logs to Excel / CSV
 */
export const exportAttendance = async (req, res, next) => {
  try {
    const { employeeId, year, month, format = 'xlsx' } = req.query;
    if (!employeeId) {
      return sendError(res, 'Employee ID is required for export', 400);
    }

    const emp = await Employee.findById(employeeId);
    const data = await getEmployeeMonthDayStatuses(employeeId, parseInt(year, 10), parseInt(month, 10));

    const rows = data.days.map((d) => ({
      Date: d.date,
      Status: d.label,
      WorkedHours: (d.workedMinutes / 60).toFixed(2),
      LateMinutes: d.lateMinutes,
      BreakMinutes: d.breakMinutes,
      OvertimeMinutes: d.overtimeMinutes,
      Punches: d.logs.map((l) => `${l.type.toUpperCase()}: ${new Date(l.time).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`).join(', '),
    }));

    const filename = `Attendance_${emp?.personal?.firstName || 'Staff'}_${year}_${month}`;

    if (format === 'csv') {
      const csv = exportToCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    const excelBuffer = await exportToExcel(rows, 'Attendance Register');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
};
