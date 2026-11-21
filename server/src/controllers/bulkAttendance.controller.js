import mongoose from 'mongoose';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Attendance } from '../models/Attendance.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { Employee } from '../models/Employee.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { BulkAction } from '../models/BulkAction.js';
import { AuditLog } from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { calculateDayStatus, toISTDateString, getCompanyPolicy } from '../services/dayStatus.service.js';

/**
 * Helper: Check if date is within locked period
 */
const isDateLocked = async (dateStr) => {
  const policy = await getCompanyPolicy();
  if (!policy.attendanceLockedUpToDate) return false;
  const lockedDateStr = toISTDateString(policy.attendanceLockedUpToDate);
  return dateStr <= lockedDateStr;
};

/**
 * 1. GET Real-time Timer Statuses for today
 */
export const getTimerStatuses = async (req, res, next) => {
  try {
    const todayIST = toISTDateString(new Date());
    const employees = await Employee.find({ status: 'active', isDeleted: false })
      .populate('employment.department', 'name code')
      .select('personal.firstName personal.lastName employeeId employment.department');

    const logsToday = await AttendanceLog.find({
      date: todayIST,
      isDeleted: false,
    }).sort({ time: 1 });

    const results = employees.map((emp) => {
      const empLogs = logsToday.filter((l) => String(l.employee) === String(emp._id));
      const inPunches = empLogs.filter((l) => l.type === 'in');
      const outPunches = empLogs.filter((l) => l.type === 'out');

      const isRunning = inPunches.length > outPunches.length;
      const firstIn = inPunches[0]?.time || null;
      const lastOut = outPunches[outPunches.length - 1]?.time || null;

      let workedMinutes = 0;
      if (firstIn && lastOut) {
        workedMinutes = Math.max(0, Math.round((new Date(lastOut) - new Date(firstIn)) / 60000));
      } else if (firstIn && isRunning) {
        workedMinutes = Math.max(0, Math.round((Date.now() - new Date(firstIn)) / 60000));
      }

      return {
        employeeId: emp._id,
        employeeCode: emp.employeeId,
        name: `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim(),
        department: emp.employment?.department?.name || 'General',
        timerStatus: isRunning ? 'Running' : 'Not Running',
        firstIn,
        lastOut,
        workedMinutes,
        workedHours: parseFloat((workedMinutes / 60).toFixed(1)),
        logsCount: empLogs.length,
      };
    });

    return sendSuccess(res, results, 'Timer statuses retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 2. POST Preview Bulk Action (Conflict detection before save)
 */
export const previewBulkPunch = async (req, res, next) => {
  try {
    const { employeeIds = [], date, actionType = 'in', time = '10:00' } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return sendError(res, 'At least one employee must be selected', 400);
    }

    if (employeeIds.length > 100) {
      return sendError(res, 'Maximum 100 employees permitted per bulk operation', 400);
    }

    if (!date) return sendError(res, 'Date is required', 400);

    const dateStr = toISTDateString(date);

    // Check locked period
    if (await isDateLocked(dateStr)) {
      const policy = await getCompanyPolicy();
      const lockedStr = toISTDateString(policy.attendanceLockedUpToDate);
      return sendError(res, `Attendance period is locked up to ${lockedStr}. Modifications are blocked.`, 400);
    }

    const proposedPunchTime = new Date(`${dateStr}T${time}:00.000Z`);
    // Convert proposed time to UTC timestamp based on IST
    const [h, m] = time.split(':').map(Number);
    const dayStartUTC = new Date(`${dateStr}T00:00:00.000Z`);
    const punchTimestamp = new Date(dayStartUTC.getTime() + (h * 60 + m - 330) * 60000);

    const now = new Date();
    const isFuture = punchTimestamp > now;

    // Preload holidays and policy
    const policy = await getCompanyPolicy();
    const dayOfWeek = dayStartUTC.getUTCDay();
    const isWeekOff = policy.weekOffDays.includes(dayOfWeek);

    const holiday = await Holiday.findOne({
      date: { $gte: dayStartUTC, $lte: new Date(`${dateStr}T23:59:59.999Z`) },
    });

    const employees = await Employee.find({ _id: { $in: employeeIds } })
      .populate('employment.department', 'name code')
      .select('personal.firstName personal.lastName employeeId employment.department');

    const logsForDate = await AttendanceLog.find({
      employee: { $in: employeeIds },
      date: dateStr,
      isDeleted: false,
    }).sort({ time: 1 });

    const activeLeaves = await LeaveRequest.find({
      employee: { $in: employeeIds },
      status: 'approved',
      fromDate: { $lte: new Date(`${dateStr}T23:59:59.999Z`) },
      toDate: { $gte: dayStartUTC },
    }).populate('leaveType', 'name');

    const previewRows = employees.map((emp) => {
      const empLogs = logsForDate.filter((l) => String(l.employee) === String(emp._id));
      const empLeave = activeLeaves.find((lv) => String(lv.employee) === String(emp._id));

      const inPunches = empLogs.filter((l) => l.type === 'in');
      const outPunches = empLogs.filter((l) => l.type === 'out');

      const conflicts = [];

      if (isFuture) {
        conflicts.push('Proposed punch time is in the future');
      }

      if (actionType === 'in') {
        if (inPunches.length > 0) {
          conflicts.push(`Already has a clock-in punch at ${new Date(inPunches[0].time).toLocaleTimeString('en-IN')}`);
        }
      } else if (actionType === 'out') {
        if (inPunches.length === 0) {
          conflicts.push('Missing clock-in punch for this date');
        } else {
          const firstIn = inPunches[0].time;
          if (punchTimestamp <= firstIn) {
            conflicts.push('Clock-out time must be later than clock-in time');
          }
        }
      }

      if (empLeave) {
        conflicts.push(`Employee is on approved leave (${empLeave.leaveType?.name || 'Leave'})`);
      }

      if (holiday) {
        conflicts.push(`Date is a declared company holiday (${holiday.name})`);
      } else if (isWeekOff) {
        conflicts.push('Date is a scheduled Sunday week-off');
      }

      // Check exact duplicate punch
      const duplicate = empLogs.find(
        (l) => l.type === actionType && Math.abs(new Date(l.time) - punchTimestamp) < 60000
      );
      if (duplicate) {
        conflicts.push(`Duplicate punch: identical ${actionType} punch already recorded`);
      }

      const hasConflict = conflicts.length > 0;

      return {
        employeeId: emp._id,
        employeeCode: emp.employeeId,
        name: `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim(),
        department: emp.employment?.department?.name || 'General',
        existingLogsCount: empLogs.length,
        existingLogs: empLogs.map((l) => ({
          type: l.type,
          time: l.time,
          source: l.source,
        })),
        actionType,
        punchTime: punchTimestamp,
        hasConflict,
        conflicts,
        status: hasConflict ? 'conflict' : 'ready',
      };
    });

    const summary = {
      total: previewRows.length,
      ready: previewRows.filter((r) => !r.hasConflict).length,
      conflicts: previewRows.filter((r) => r.hasConflict).length,
    };

    return sendSuccess(res, { previewRows, summary, dateStr, actionType, punchTime: punchTimestamp }, 'Bulk preview generated');
  } catch (err) {
    next(err);
  }
};

/**
 * 3. POST Execute Bulk Punch
 */
export const executeBulkPunch = async (req, res, next) => {
  try {
    const {
      employeeIds = [],
      date,
      actionType = 'in',
      time = '10:00',
      reason,
      overrides = {}, // { [empId]: boolean }
      overrideReason = '',
    } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, 'A clear reason for bulk punch logging is required', 400);
    }

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return sendError(res, 'At least one employee must be selected', 400);
    }

    if (employeeIds.length > 100) {
      return sendError(res, 'Maximum 100 employees permitted per bulk operation', 400);
    }

    const dateStr = toISTDateString(date);

    // Check locked period
    if (await isDateLocked(dateStr)) {
      const policy = await getCompanyPolicy();
      const lockedStr = toISTDateString(policy.attendanceLockedUpToDate);
      return sendError(res, `Attendance period is locked up to ${lockedStr}. Bulk action blocked.`, 400);
    }

    const [h, m] = time.split(':').map(Number);
    const dayStartUTC = new Date(`${dateStr}T00:00:00.000Z`);
    const punchTimestamp = new Date(dayStartUTC.getTime() + (h * 60 + m - 330) * 60000);

    const bulkActionId = `BULK-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const employees = await Employee.find({ _id: { $in: employeeIds } })
      .select('personal.firstName personal.lastName employeeId');

    const details = [];
    const logsCreatedIds = [];
    const affectedEmpIds = [];

    for (const emp of employees) {
      const empIdStr = String(emp._id);
      const isOverridden = !!overrides[empIdStr];

      try {
        // Idempotency check: check if exact identical punch already exists
        const existingSamePunch = await AttendanceLog.findOne({
          employee: emp._id,
          date: dateStr,
          type: actionType,
          isDeleted: false,
          time: {
            $gte: new Date(punchTimestamp.getTime() - 60000),
            $lte: new Date(punchTimestamp.getTime() + 60000),
          },
        });

        if (existingSamePunch) {
          details.push({
            employee: emp._id,
            employeeName: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
            employeeCode: emp.employeeId,
            status: 'skipped',
            reason: 'Identical punch already exists (Idempotent protection)',
            logId: existingSamePunch._id,
          });
          continue;
        }

        // Conflict evaluation
        const existingLogs = await AttendanceLog.find({
          employee: emp._id,
          date: dateStr,
          isDeleted: false,
        }).sort({ time: 1 });

        const inPunches = existingLogs.filter((l) => l.type === 'in');

        let conflictReason = null;
        if (actionType === 'in' && inPunches.length > 0) {
          conflictReason = 'Already clocked in on this date';
        } else if (actionType === 'out' && inPunches.length === 0) {
          conflictReason = 'Missing clock-in punch';
        } else if (actionType === 'out' && punchTimestamp <= inPunches[0].time) {
          conflictReason = 'Clock-out time is earlier than clock-in time';
        }

        if (conflictReason && !isOverridden) {
          details.push({
            employee: emp._id,
            employeeName: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
            employeeCode: emp.employeeId,
            status: 'skipped',
            reason: conflictReason,
          });
          continue;
        }

        // Create the log
        const log = await AttendanceLog.create({
          employee: emp._id,
          date: dateStr,
          type: actionType,
          time: punchTimestamp,
          source: 'bulk',
          note: isOverridden
            ? `Bulk Override (${reason}): ${overrideReason || 'Admin Override'}`
            : `Bulk Punch: ${reason}`,
          bulkActionId,
          changedBy: req.user._id,
        });

        logsCreatedIds.push(log._id);
        affectedEmpIds.push(emp._id);

        // Recalculate day status
        await calculateDayStatus(emp._id, dateStr);

        details.push({
          employee: emp._id,
          employeeName: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
          employeeCode: emp.employeeId,
          status: 'succeeded',
          reason: isOverridden ? 'Punched with Admin Override' : 'Punched successfully',
          logId: log._id,
        });
      } catch (rowErr) {
        details.push({
          employee: emp._id,
          employeeName: `${emp.personal?.firstName} ${emp.personal?.lastName}`,
          employeeCode: emp.employeeId,
          status: 'failed',
          reason: rowErr.message,
        });
      }
    }

    const summary = {
      requestedCount: employeeIds.length,
      succeededCount: details.filter((d) => d.status === 'succeeded').length,
      skippedCount: details.filter((d) => d.status === 'skipped').length,
      failedCount: details.filter((d) => d.status === 'failed').length,
    };

    // Save BulkAction document
    const bulkAction = await BulkAction.create({
      bulkActionId,
      actionType,
      date: dateStr,
      punchTime: punchTimestamp,
      reason,
      executedBy: req.user._id,
      affectedEmployees: affectedEmpIds,
      logsCreated: logsCreatedIds,
      summary,
      details,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hr undo window
    });

    // Record in AuditLog
    await AuditLog.create({
      user: req.user._id,
      userEmail: req.user.email,
      action: 'BULK_PUNCH',
      entity: 'BulkAction',
      entityId: bulkAction._id,
      changes: {
        bulkActionId,
        date: dateStr,
        actionType,
        summary,
        reason,
      },
    });

    return sendSuccess(res, bulkAction, `Bulk punch completed: ${summary.succeededCount} succeeded, ${summary.skippedCount} skipped, ${summary.failedCount} failed`);
  } catch (err) {
    next(err);
  }
};

/**
 * 4. POST Undo Bulk Action (Valid within 24h)
 */
export const undoBulkAction = async (req, res, next) => {
  try {
    const { bulkActionId } = req.params;

    const bulkAction = await BulkAction.findOne({ bulkActionId });
    if (!bulkAction) {
      return sendError(res, 'Bulk action record not found', 404);
    }

    if (bulkAction.isUndone) {
      return sendError(res, 'This bulk action has already been undone', 400);
    }

    // Check 24-hour expiry
    if (new Date() > bulkAction.expiresAt) {
      return sendError(res, 'The 24-hour undo window for this bulk action has expired', 400);
    }

    // Check locked period
    if (await isDateLocked(bulkAction.date)) {
      return sendError(res, 'Cannot undo: the attendance period for this date is now locked', 400);
    }

    // Permanently remove ONLY logs created by this bulk action
    const deleteResult = await AttendanceLog.deleteMany({ bulkActionId });

    // Mark bulk action as undone
    bulkAction.isUndone = true;
    bulkAction.undoneAt = new Date();
    bulkAction.undoneBy = req.user._id;
    await bulkAction.save();

    // Recalculate day status for all affected employees
    for (const empId of bulkAction.affectedEmployees) {
      await calculateDayStatus(empId, bulkAction.date);
    }

    // AuditLog
    await AuditLog.create({
      user: req.user._id,
      userEmail: req.user.email,
      action: 'UNDO_BULK_PUNCH',
      entity: 'BulkAction',
      entityId: bulkAction._id,
      changes: {
        bulkActionId,
        deletedLogsCount: deleteResult.deletedCount,
      },
    });

    return sendSuccess(res, { bulkActionId, deletedLogsCount: deleteResult.deletedCount }, 'Bulk action successfully undone. All created punches removed.');
  } catch (err) {
    next(err);
  }
};

/**
 * 5. GET Recent Bulk Actions List (for Undo drawer & history)
 */
export const getRecentBulkActions = async (req, res, next) => {
  try {
    const actions = await BulkAction.find()
      .populate('executedBy', 'email')
      .populate('undoneBy', 'email')
      .sort({ createdAt: -1 })
      .limit(30);

    return sendSuccess(res, actions, 'Recent bulk actions retrieved');
  } catch (err) {
    next(err);
  }
};
