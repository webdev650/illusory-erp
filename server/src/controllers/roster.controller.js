import mongoose from 'mongoose';
import { Shift } from '../models/Shift.js';
import { ShiftAssignment } from '../models/ShiftAssignment.js';
import { RosterChangeHistory } from '../models/RosterChangeHistory.js';
import { Employee } from '../models/Employee.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  calculateDayStatus,
  toISTDateString,
  getCompanyPolicy,
  resolveEmployeeShift,
} from '../services/dayStatus.service.js';

/**
 * Helper: Check if date is locked by attendance policy
 */
const isDateLocked = async (dateStr) => {
  const policy = await getCompanyPolicy();
  if (!policy.attendanceLockedUpToDate) return false;
  const lockedDateStr = toISTDateString(policy.attendanceLockedUpToDate);
  return dateStr <= lockedDateStr;
};

/**
 * 1. GET Shift Templates
 */
export const getShifts = async (req, res, next) => {
  try {
    const shifts = await Shift.find().sort({ isDefault: -1, name: 1 });
    return sendSuccess(res, shifts, 'Shift templates retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 2. POST Create Shift Template
 */
export const createShift = async (req, res, next) => {
  try {
    const {
      name,
      startTime = '10:00',
      endTime = '18:45',
      graceMinutes = 15,
      unpaidBreakMinutes = 60,
      workingMinutes = 465,
      workingDays = [1, 2, 3, 4, 5, 6],
      halfDayHours = 4,
      fullDayHours = 7.75,
      isDefault = false,
    } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 'Shift name is required', 400);
    }

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      return sendError(
        res,
        'Overnight shifts crossing midnight are not currently supported. Shift start time must be earlier than end time on the same day (planned future feature).',
        400
      );
    }

    if (isDefault) {
      await Shift.updateMany({ isDefault: true }, { isDefault: false });
    }

    const shift = await Shift.create({
      name: name.trim(),
      startTime,
      endTime,
      graceMinutes,
      unpaidBreakMinutes,
      workingMinutes,
      workingDays,
      halfDayHours,
      fullDayHours,
      isDefault,
    });

    return sendSuccess(res, shift, 'Shift template created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 3. PUT Update Shift Template
 */
export const updateShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      startTime,
      endTime,
      graceMinutes,
      unpaidBreakMinutes,
      workingMinutes,
      workingDays,
      halfDayHours,
      fullDayHours,
      isDefault,
    } = req.body;

    const shift = await Shift.findById(id);
    if (!shift) return sendError(res, 'Shift not found', 404);

    const sTime = startTime || shift.startTime;
    const eTime = endTime || shift.endTime;

    const [startH, startM] = sTime.split(':').map(Number);
    const [endH, endM] = eTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (endMins <= startMins) {
      return sendError(
        res,
        'Overnight shifts crossing midnight are not currently supported. Shift start time must be earlier than end time on the same day (planned future feature).',
        400
      );
    }

    if (isDefault) {
      await Shift.updateMany({ _id: { $ne: id }, isDefault: true }, { isDefault: false });
    }

    if (name) shift.name = name.trim();
    if (startTime) shift.startTime = startTime;
    if (endTime) shift.endTime = endTime;
    if (graceMinutes !== undefined) shift.graceMinutes = graceMinutes;
    if (unpaidBreakMinutes !== undefined) shift.unpaidBreakMinutes = unpaidBreakMinutes;
    if (workingMinutes !== undefined) shift.workingMinutes = workingMinutes;
    if (workingDays) shift.workingDays = workingDays;
    if (halfDayHours !== undefined) shift.halfDayHours = halfDayHours;
    if (fullDayHours !== undefined) shift.fullDayHours = fullDayHours;
    if (isDefault !== undefined) shift.isDefault = isDefault;

    await shift.save();

    return sendSuccess(res, shift, 'Shift template updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 4. DELETE Shift Template
 */
export const deleteShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const shift = await Shift.findById(id);
    if (!shift) return sendError(res, 'Shift not found', 404);

    if (shift.isDefault) {
      return sendError(res, 'Cannot delete the default company shift template', 400);
    }

    await Shift.findByIdAndDelete(id);
    return sendSuccess(res, null, 'Shift template deleted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 5. GET Roster Matrix (Employees x Dates)
 */
export const getRosterMatrix = async (req, res, next) => {
  try {
    const { startDate, endDate, department, employeeId } = req.query;

    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const startStr = startDate ? toISTDateString(startDate) : toISTDateString(defaultStart);
    const endStr = endDate ? toISTDateString(endDate) : toISTDateString(defaultEnd);

    const userRole = req.userRole;
    const userPermissions = req.permissions || [];
    const isSuperAdminOrHR =
      ['super_admin', 'admin', 'hr'].includes(userRole) ||
      userPermissions.includes('*') ||
      userPermissions.includes('attendance.manage');

    // Get current user's employee record
    const currentEmp = await Employee.findOne({
      $or: [{ _id: req.user.employee }, { 'personal.officialEmail': req.user.email }],
    });

    let employeeFilter = { status: 'active', isDeleted: false };

    // RBAC Scoping
    if (!isSuperAdminOrHR) {
      if (userRole === 'manager') {
        if (employeeId) {
          // Verify manager owns this employee
          const target = await Employee.findById(employeeId);
          if (
            !target ||
            (String(target._id) !== String(currentEmp?._id) &&
              String(target.employment?.reportingManager) !== String(currentEmp?._id))
          ) {
            return sendError(res, 'Access denied. You can only view your own or your team members roster.', 403);
          }
          employeeFilter._id = employeeId;
        } else {
          // Show manager + direct reports
          employeeFilter.$or = [
            { _id: currentEmp?._id },
            { 'employment.reportingManager': currentEmp?._id },
          ];
        }
      } else {
        // Regular Employee: can ONLY view own roster!
        if (employeeId && currentEmp && String(employeeId) !== String(currentEmp._id)) {
          return sendError(res, 'Access denied. You can only view your own shift roster.', 403);
        }
        if (!currentEmp) {
          return sendError(res, 'No linked employee profile found for your account', 404);
        }
        employeeFilter._id = currentEmp._id;
      }
    } else {
      if (employeeId) employeeFilter._id = employeeId;
      if (department) employeeFilter['employment.department'] = department;
    }

    const employees = await Employee.find(employeeFilter)
      .populate('employment.department', 'name code')
      .select('personal.firstName personal.lastName employeeId employment.department employment.designation')
      .sort({ 'personal.firstName': 1 });

    // Generate dates array
    const dates = [];
    const curr = new Date(`${startStr}T00:00:00.000Z`);
    const end = new Date(`${endStr}T00:00:00.000Z`);

    while (curr <= end) {
      dates.push(toISTDateString(curr));
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const empIds = employees.map((e) => e._id);

    // Fetch shift assignments in date range
    const assignments = await ShiftAssignment.find({
      employee: { $in: empIds },
      startDate: { $lte: new Date(`${endStr}T23:59:59.999Z`) },
      $or: [{ endDate: null }, { endDate: { $gte: new Date(`${startStr}T00:00:00.000Z`) } }],
    }).populate('shift');

    // Fetch holidays
    const holidays = await Holiday.find({
      date: {
        $gte: new Date(`${startStr}T00:00:00.000Z`),
        $lte: new Date(`${endStr}T23:59:59.999Z`),
      },
    });

    // Fetch approved leaves
    const leaves = await LeaveRequest.find({
      employee: { $in: empIds },
      status: 'approved',
      fromDate: { $lte: new Date(`${endStr}T23:59:59.999Z`) },
      toDate: { $gte: new Date(`${startStr}T00:00:00.000Z`) },
    }).populate('leaveType', 'name code');

    // Fetch approved remote work
    const remotes = await RemoteWorkRequest.find({
      employee: { $in: empIds },
      status: 'approved',
      fromDate: { $lte: new Date(`${endStr}T23:59:59.999Z`) },
      toDate: { $gte: new Date(`${startStr}T00:00:00.000Z`) },
    });

    const policy = await getCompanyPolicy();
    const defaultShift = await Shift.findOne({ isDefault: true }) || await Shift.findOne();

    // Build matrix
    const matrix = employees.map((emp) => {
      const empIdStr = String(emp._id);
      const empAssignments = assignments.filter((a) => String(a.employee) === empIdStr);
      const empLeaves = leaves.filter((l) => String(l.employee) === empIdStr);
      const empRemotes = remotes.filter((r) => String(r.employee) === empIdStr);

      const days = {};

      dates.forEach((dStr) => {
        const dUTC = new Date(`${dStr}T00:00:00.000Z`);
        const dayOfWeek = dUTC.getUTCDay();
        const isPolicyWeekOff = policy.weekOffDays.includes(dayOfWeek);

        // Conflict badges
        const holiday = holidays.find((h) => toISTDateString(h.date) === dStr);
        const leave = empLeaves.find((l) => {
          const lFrom = toISTDateString(l.fromDate);
          const lTo = toISTDateString(l.toDate);
          return dStr >= lFrom && dStr <= lTo;
        });
        const remote = empRemotes.find((r) => {
          const rFrom = toISTDateString(r.fromDate);
          const rTo = toISTDateString(r.toDate);
          return dStr >= rFrom && dStr <= rTo;
        });

        // Resolve shift: special > deleted > default
        const activeForDate = empAssignments.filter((a) => {
          const aStart = toISTDateString(a.startDate);
          const aEnd = a.endDate ? toISTDateString(a.endDate) : null;
          return dStr >= aStart && (!aEnd || dStr <= aEnd);
        });

        const special = activeForDate.find((a) => a.type === 'special');
        const deleted = activeForDate.find((a) => a.type === 'deleted');
        const defaultAssigned = activeForDate.find((a) => a.type === 'default');

        let resolvedShift = null;
        let shiftType = 'default';

        if (special && special.shift) {
          resolvedShift = special.shift;
          shiftType = 'special';
        } else if (deleted) {
          resolvedShift = null;
          shiftType = 'deleted';
        } else if (defaultAssigned && defaultAssigned.shift) {
          resolvedShift = defaultAssigned.shift;
          shiftType = 'default';
        } else {
          resolvedShift = defaultShift;
          shiftType = 'default';
        }

        days[dStr] = {
          date: dStr,
          shiftId: resolvedShift?._id || null,
          shiftName: resolvedShift?.name || (shiftType === 'deleted' ? 'Day Off' : 'General'),
          startTime: resolvedShift?.startTime || null,
          endTime: resolvedShift?.endTime || null,
          workingMinutes: resolvedShift?.workingMinutes || 0,
          type: shiftType, // 'default', 'special', 'deleted'
          isDayOff: shiftType === 'deleted' || isPolicyWeekOff,
          conflicts: {
            isHoliday: !!holiday,
            holidayName: holiday?.name || null,
            isLeave: !!leave,
            leaveName: leave?.leaveType?.name || null,
            isRemote: !!remote,
            isWeekOff: isPolicyWeekOff,
          },
        };
      });

      return {
        employee: {
          _id: emp._id,
          employeeCode: emp.employeeId,
          name: `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim(),
          department: emp.employment?.department?.name || 'General',
          designation: emp.employment?.designation || '',
        },
        days,
      };
    });

    return sendSuccess(
      res,
      {
        dates,
        matrix,
        startDate: startStr,
        endDate: endStr,
        isLocked: await isDateLocked(endStr),
      },
      'Roster matrix retrieved'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 6. POST Assign Roster (Bulk or Single cell assignment)
 */
export const assignRoster = async (req, res, next) => {
  try {
    const { assignments = [], reason = '' } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return sendError(res, 'At least one roster assignment is required', 400);
    }

    if (assignments.length > 200) {
      return sendError(res, 'Maximum 200 roster assignments permitted per operation', 400);
    }

    const todayIST = toISTDateString(new Date());

    // Check locked period across all assignment dates
    for (const item of assignments) {
      const dStr = toISTDateString(item.date);
      if (await isDateLocked(dStr)) {
        const policy = await getCompanyPolicy();
        const lockedStr = toISTDateString(policy.attendanceLockedUpToDate);
        return sendError(
          res,
          `Cannot modify roster for ${dStr}: attendance period is locked up to ${lockedStr}`,
          400
        );
      }
    }

    // Check if any assignment modifies past date or day with logs
    let hasPastOrLoggedDays = false;
    for (const item of assignments) {
      const dStr = toISTDateString(item.date);
      if (dStr < todayIST) {
        hasPastOrLoggedDays = true;
        break;
      }
      const existingLogs = await AttendanceLog.countDocuments({
        employee: item.employeeId,
        date: dStr,
        isDeleted: false,
      });
      if (existingLogs > 0) {
        hasPastOrLoggedDays = true;
        break;
      }
    }

    if (hasPastOrLoggedDays && (!reason || !reason.trim())) {
      return sendError(
        res,
        'A mandatory reason is required when modifying shift rosters for past dates or dates with existing logs',
        400
      );
    }

    let updatedCount = 0;
    let affectedPastCount = 0;
    const affectedEmployeesSet = new Set();
    const affectedDatesSet = new Set();

    for (const item of assignments) {
      const { employeeId, date, shiftId, type = 'special' } = item;
      const dStr = toISTDateString(date);
      const isPast = dStr < todayIST;
      if (isPast) affectedPastCount++;

      const targetDateUTC = new Date(`${dStr}T00:00:00.000Z`);
      const targetDateEndUTC = new Date(`${dStr}T23:59:59.999Z`);

      // Find current shift for employee on that date
      const currentResolved = await resolveEmployeeShift(employeeId, dStr);
      const oldShiftId = currentResolved.shift?._id || null;

      let newShiftId = shiftId || null;
      let changeType = 'assign';

      if (type === 'deleted') {
        changeType = 'remove';
        newShiftId = null;
      }

      // Check if already same
      if (String(oldShiftId) === String(newShiftId) && currentResolved.type === type) {
        continue;
      }

      // Clean up previous special/deleted assignments for this exact day
      await ShiftAssignment.deleteMany({
        employee: employeeId,
        startDate: { $gte: targetDateUTC, $lte: targetDateEndUTC },
        type: { $in: ['special', 'deleted'] },
      });

      // Create new specific day assignment
      if (type === 'deleted') {
        // Scheduled Day Off
        const defaultShift = await Shift.findOne({ isDefault: true }) || await Shift.findOne();
        await ShiftAssignment.create({
          employee: employeeId,
          shift: defaultShift._id,
          startDate: targetDateUTC,
          endDate: targetDateEndUTC,
          type: 'deleted',
          remarks: reason || 'Scheduled Day Off',
          createdBy: req.user._id,
        });
      } else {
        await ShiftAssignment.create({
          employee: employeeId,
          shift: newShiftId,
          startDate: targetDateUTC,
          endDate: targetDateEndUTC,
          type: type || 'special',
          remarks: reason || 'Roster update',
          createdBy: req.user._id,
        });
      }

      // Record History
      await RosterChangeHistory.create({
        employee: employeeId,
        date: dStr,
        oldShift: oldShiftId,
        newShift: newShiftId,
        changeType,
        reason: reason?.trim() || '',
        changedBy: req.user._id,
        affectedPastDate: isPast,
        appliedAt: new Date(),
      });

      // Recalculate day status for affected day
      await calculateDayStatus(employeeId, dStr);

      affectedEmployeesSet.add(String(employeeId));
      affectedDatesSet.add(dStr);
      updatedCount++;
    }

    // Dispatch notifications to affected employees
    const newShiftDoc = assignments[0]?.shiftId ? await Shift.findById(assignments[0].shiftId) : null;
    const shiftLabel = newShiftDoc ? newShiftDoc.name : 'Shift Roster';

    for (const empId of affectedEmployeesSet) {
      const user = await User.findOne({ employee: empId });
      if (user) {
        await Notification.create({
          user: user._id,
          title: 'Shift Roster Updated',
          message: `Your shift roster has been updated for ${affectedDatesSet.size} day(s) to ${shiftLabel}.`,
          type: 'attendance',
          link: '/hrms/attendance/roster',
        });
      }
    }

    // AuditLog
    await AuditLog.create({
      user: req.user._id,
      userEmail: req.user.email,
      action: 'ROSTER_ASSIGN',
      entity: 'ShiftAssignment',
      changes: {
        updatedAssignmentsCount: updatedCount,
        affectedPastCount,
        reason,
        affectedEmployees: Array.from(affectedEmployeesSet),
      },
    });

    return sendSuccess(
      res,
      {
        updatedCount,
        affectedPastCount,
        affectedEmployeesCount: affectedEmployeesSet.size,
        affectedDaysCount: affectedDatesSet.size,
      },
      `Roster assigned successfully for ${updatedCount} slot(s). Day statuses recalculated.`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 7. GET Roster Change History
 */
export const getRosterHistory = async (req, res, next) => {
  try {
    const { employeeId, limit = 50 } = req.query;
    const userRole = req.userRole;
    const userPermissions = req.permissions || [];
    const isSuperAdminOrHR =
      ['super_admin', 'admin', 'hr'].includes(userRole) ||
      userPermissions.includes('*') ||
      userPermissions.includes('attendance.manage');

    const filter = {};

    if (!isSuperAdminOrHR) {
      const currentEmp = await Employee.findOne({
        $or: [{ _id: req.user.employee }, { 'personal.officialEmail': req.user.email }],
      });
      if (currentEmp) {
        filter.employee = currentEmp._id;
      }
    } else if (employeeId) {
      filter.employee = employeeId;
    }

    const history = await RosterChangeHistory.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('oldShift', 'name startTime endTime')
      .populate('newShift', 'name startTime endTime')
      .populate('changedBy', 'email')
      .sort({ appliedAt: -1, createdAt: -1 })
      .limit(Math.min(100, Number(limit)));

    return sendSuccess(res, history, 'Roster change history retrieved');
  } catch (err) {
    next(err);
  }
};
