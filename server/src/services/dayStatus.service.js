import mongoose from 'mongoose';
import { Shift } from '../models/Shift.js';
import { ShiftAssignment } from '../models/ShiftAssignment.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Attendance } from '../models/Attendance.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';

export const STATUS_CONFIG = {
  LOG_OK: {
    key: 'LOG_OK',
    label: 'Log Ok',
    color: '#10B981', // Emerald 500
    bg: '#ECFDF5',
    text: '#065F46',
    border: '#A7F3D0',
  },
  BREAK_LOG: {
    key: 'BREAK_LOG',
    label: 'Break Log',
    color: '#06B6D4', // Cyan 500
    bg: '#ECFEFF',
    text: '#155E75',
    border: '#A5F3FC',
  },
  LEAVE: {
    key: 'LEAVE',
    label: 'Leave',
    color: '#6366F1', // Indigo 500
    bg: '#EEF2FF',
    text: '#3730A3',
    border: '#C7D2FE',
  },
  LOG_ERROR: {
    key: 'LOG_ERROR',
    label: 'Log Error',
    color: '#F59E0B', // Amber 500
    bg: '#FFFBEB',
    text: '#92400E',
    border: '#FDE68A',
  },
  DELETED_LOG: {
    key: 'DELETED_LOG',
    label: 'Deleted Log',
    color: '#64748B', // Slate 500
    bg: '#F8FAFC',
    text: '#334155',
    border: '#E2E8F0',
  },
  HOLIDAY: {
    key: 'HOLIDAY',
    label: 'Holiday',
    color: '#8B5CF6', // Purple 500
    bg: '#F5F3FF',
    text: '#5B21B6',
    border: '#DDD6FE',
  },
  WEEK_OFF: {
    key: 'WEEK_OFF',
    label: 'Week Off',
    color: '#94A3B8', // Slate 400
    bg: '#F1F5F9',
    text: '#475569',
    border: '#CBD5E1',
  },
  NOT_PA: {
    key: 'NOT_PA',
    label: 'NOT P/A',
    color: '#EF4444', // Red 500
    bg: '#FEF2F2',
    text: '#991B1B',
    border: '#FECACA',
  },
  CHANGED_LOG: {
    key: 'CHANGED_LOG',
    label: 'Changed Log',
    color: '#0D9488', // Teal 600
    bg: '#F0FDFA',
    text: '#115E59',
    border: '#99F6E4',
  },
  COMPANY_OUTSIDE_LEAVE: {
    key: 'COMPANY_OUTSIDE_LEAVE',
    label: 'Company Outside Leave',
    color: '#E11D48', // Rose 600
    bg: '#FFF1F2',
    text: '#9F1239',
    border: '#FECDD3',
  },
  REJECTED_LEAVE: {
    key: 'REJECTED_LEAVE',
    label: 'Rejected Leave',
    color: '#78716C', // Stone 500
    bg: '#F5F5F4',
    text: '#44403C',
    border: '#D6D3D1',
  },
  REMOTE_WORK: {
    key: 'REMOTE_WORK',
    label: 'Remote Work',
    color: '#0284C7', // Sky 600
    bg: '#F0F9FF',
    text: '#075985',
    border: '#BAE6FD',
  },
  PARTIAL_DAY: {
    key: 'PARTIAL_DAY',
    label: 'Partial Day',
    color: '#D97706', // Amber 600
    bg: '#FEF3C7',
    text: '#78350F',
    border: '#FCD34D',
  },
  LOG_REQUEST_PENDING: {
    key: 'LOG_REQUEST_PENDING',
    label: 'Log Request Pending',
    color: '#7C3AED', // Violet 600
    bg: '#F3E8FF',
    text: '#6B21A8',
    border: '#DDD6FE',
  },
  RESTRICTED_DAY: {
    key: 'RESTRICTED_DAY',
    label: 'Restricted Day',
    color: '#059669', // Emerald 600
    bg: '#ECFDF5',
    text: '#065F46',
    border: '#A7F3D0',
  },
  UPCOMING: {
    key: 'UPCOMING',
    label: 'Upcoming',
    color: '#CBD5E1',
    bg: '#F8FAFC',
    text: '#64748B',
    border: '#E2E8F0',
  },
};

/**
 * Format date to IST YYYY-MM-DD
 */
export const toISTDateString = (input) => {
  const d = new Date(input);
  if (isNaN(d.getTime())) return '';
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(d.getTime() + istOffset);
  return istTime.toISOString().split('T')[0];
};

/**
 * Get company AttendancePolicy or create fallback
 */
export const getCompanyPolicy = async () => {
  let policy = await AttendancePolicy.findOne({ isDefault: true });
  if (!policy) {
    policy = await AttendancePolicy.findOne().sort({ createdAt: -1 });
  }
  if (!policy) {
    policy = await AttendancePolicy.create({
      name: 'Default Studio Policy',
      graceMinutes: 15,
      lateAfter: 15,
      halfDayMinMinutes: 240,
      fullDayMinMinutes: 465,
      autoCloseMissingClockOutAt: '19:00',
      maxBackdateDays: 15,
      weekOffDays: [0],
      breakMinutes: 60,
      isDefault: true,
    });
  }
  return policy;
};

/**
 * Resolve Shift for an employee on a given IST date
 */
export const resolveEmployeeShift = async (employeeId, dateStr) => {
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);

  // 1. Look for special or deleted assignment
  const assignments = await ShiftAssignment.find({
    employee: employeeId,
    startDate: { $lte: targetDate },
    $or: [{ endDate: null }, { endDate: { $gte: targetDate } }],
  })
    .populate('shift')
    .sort({ type: 1, createdAt: -1 }); // 'default' < 'deleted' < 'special' (special will be prioritized below)

  const specialAssignment = assignments.find((a) => a.type === 'special');
  if (specialAssignment) {
    return { shift: specialAssignment.shift, type: 'special' };
  }

  const deletedAssignment = assignments.find((a) => a.type === 'deleted');
  if (deletedAssignment) {
    return { shift: null, type: 'deleted' }; // Explicit day off
  }

  const defaultAssignment = assignments.find((a) => a.type === 'default');
  if (defaultAssignment && defaultAssignment.shift) {
    return { shift: defaultAssignment.shift, type: 'default' };
  }

  // 2. Fallback to default shift in database
  let defaultShift = await Shift.findOne({ isDefault: true });
  if (!defaultShift) {
    defaultShift = await Shift.findOne().sort({ createdAt: 1 });
  }
  if (!defaultShift) {
    defaultShift = await Shift.create({
      name: 'General Studio Shift',
      startTime: '10:00',
      endTime: '18:45',
      graceMinutes: 15,
      unpaidBreakMinutes: 60,
      workingMinutes: 465,
      workingDays: [1, 2, 3, 4, 5, 6],
      halfDayHours: 4,
      fullDayHours: 7.75,
      isDefault: true,
    });
  }

  return { shift: defaultShift, type: 'default' };
};

/**
 * Calculate single day status for employee + date
 */
export const calculateDayStatus = async (employeeId, dateInput, options = {}) => {
  const dateStr = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? dateInput
    : toISTDateString(dateInput);

  const policy = options.policy || (await getCompanyPolicy());
  const { shift, type: shiftType } = await resolveEmployeeShift(employeeId, dateStr);

  const dayStartUTC = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEndUTC = new Date(`${dateStr}T23:59:59.999Z`);
  const todayIST = toISTDateString(new Date());
  const isPast = dateStr < todayIST;
  const isToday = dateStr === todayIST;
  const isFuture = dateStr > todayIST;

  // Day of week in IST (0 = Sunday, 1 = Monday, ...)
  // Note: YYYY-MM-DD parsed in UTC matches day-of-week
  const dayOfWeek = dayStartUTC.getUTCDay();
  const isWeekOff = policy.weekOffDays.includes(dayOfWeek) || shiftType === 'deleted';

  // 1. Check Holiday
  const holiday = await Holiday.findOne({
    date: { $gte: dayStartUTC, $lte: dayEndUTC },
  });

  // 2. Check Approved Leave
  const leave = await LeaveRequest.findOne({
    employee: employeeId,
    status: 'approved',
    $or: [
      { fromDate: { $lte: dayEndUTC }, toDate: { $gte: dayStartUTC } },
      { startDate: { $lte: dayEndUTC }, endDate: { $gte: dayStartUTC } },
    ],
  }).populate('leaveType');

  // 3. Check Remote Work Request
  const remote = await RemoteWorkRequest.findOne({
    employee: employeeId,
    status: 'approved',
    $or: [
      { fromDate: { $lte: dayEndUTC }, toDate: { $gte: dayStartUTC } },
      { date: { $gte: dayStartUTC, $lte: dayEndUTC } },
      { startDate: { $lte: dayEndUTC }, endDate: { $gte: dayStartUTC } },
    ],
  });

  // 4. Fetch Logs
  const logs = await AttendanceLog.find({
    employee: employeeId,
    date: dateStr,
  }).sort({ time: 1 });

  const activeLogs = logs.filter((l) => !l.isDeleted);
  const hasDeletedLog = logs.some((l) => l.isDeleted);
  const hasManualOrRegularized = activeLogs.some((l) => ['manual', 'regularized', 'bulk'].includes(l.source));

  // Compute worked time, breaks, late, OT
  let workedMinutes = 0;
  let breakMinutes = 0;
  let lateMinutes = 0;
  let overtimeMinutes = 0;
  let hasMissingClockOut = false;
  let isCurrentlyOnBreak = false;

  // In / Out evaluation
  const inPunches = activeLogs.filter((l) => l.type === 'in');
  const outPunches = activeLogs.filter((l) => l.type === 'out');
  const breakIns = activeLogs.filter((l) => l.type === 'break_in');
  const breakOuts = activeLogs.filter((l) => l.type === 'break_out');

  // Break duration calculation
  for (let i = 0; i < breakIns.length; i++) {
    const bIn = breakIns[i].time.getTime();
    const bOut = breakOuts[i] ? breakOuts[i].time.getTime() : null;
    if (bOut) {
      breakMinutes += Math.max(0, Math.round((bOut - bIn) / 60000));
    } else if (isToday) {
      isCurrentlyOnBreak = true;
    }
  }

  // Calculate gross work duration
  if (inPunches.length > 0) {
    const firstIn = inPunches[0].time;
    const lastOut = outPunches.length > 0 ? outPunches[outPunches.length - 1].time : null;

    if (lastOut) {
      const grossMinutes = Math.max(0, Math.round((lastOut.getTime() - firstIn.getTime()) / 60000));
      workedMinutes = Math.max(0, grossMinutes - breakMinutes);
    } else {
      hasMissingClockOut = true;
      if (isToday) {
        // Still currently clocked in
        const nowMs = Date.now();
        const grossMinutes = Math.max(0, Math.round((nowMs - firstIn.getTime()) / 60000));
        workedMinutes = Math.max(0, grossMinutes - breakMinutes);
      }
    }

    // Late calculation based on shift
    if (shift && shift.startTime) {
      const [shH, shM] = shift.startTime.split(':').map(Number);
      // Construct IST shift start time on target date
      // IST is UTC+5.5 -> UTC hours = shH - 5.5
      const shiftStartMs = new Date(dayStartUTC).getTime() + (shH * 60 + shM - 330) * 60000;
      const graceMs = (policy.graceMinutes || 15) * 60000;
      const arrivalMs = firstIn.getTime();

      if (arrivalMs > shiftStartMs + graceMs) {
        lateMinutes = Math.max(0, Math.round((arrivalMs - shiftStartMs) / 60000));
      }
    }
  }

  // Overtime calculation
  const targetWorkingMinutes = shift ? shift.workingMinutes || 465 : 465;
  if (isWeekOff || holiday) {
    // Entire work on week-off or holiday is counted as overtime
    overtimeMinutes = workedMinutes;
  } else if (workedMinutes > targetWorkingMinutes) {
    overtimeMinutes = workedMinutes - targetWorkingMinutes;
  }

  // --- DETERMINE STATUS VIA STRICT PRECEDENCE ---
  let statusKey = 'NOT_PA';

  if (isFuture) {
    if (holiday) {
      statusKey = holiday.type === 'restricted' ? 'RESTRICTED_DAY' : 'HOLIDAY';
    } else if (isWeekOff) {
      statusKey = 'WEEK_OFF';
    } else if (leave) {
      statusKey = leave.leaveType?.paid === false ? 'COMPANY_OUTSIDE_LEAVE' : 'LEAVE';
    } else if (remote) {
      statusKey = 'REMOTE_WORK';
    } else {
      statusKey = 'UPCOMING';
    }
  } else if (leave) {
    statusKey = leave.leaveType?.paid === false ? 'COMPANY_OUTSIDE_LEAVE' : 'LEAVE';
    workedMinutes = 0;
  } else if (remote) {
    statusKey = 'REMOTE_WORK';
    if (workedMinutes === 0) {
      workedMinutes = policy.creditFullHoursAutomatically !== false ? targetWorkingMinutes : 0;
    }
  } else if (holiday) {
    if (activeLogs.length > 0 && workedMinutes >= (policy.halfDayMinMinutes || 240)) {
      statusKey = 'LOG_OK';
    } else {
      statusKey = holiday.type === 'restricted' ? 'RESTRICTED_DAY' : 'HOLIDAY';
    }
  } else if (isWeekOff) {
    if (activeLogs.length > 0 && workedMinutes >= (policy.halfDayMinMinutes || 240)) {
      statusKey = 'LOG_OK';
    } else {
      statusKey = 'WEEK_OFF';
    }
  } else if (activeLogs.length === 0) {
    if (hasDeletedLog) {
      statusKey = 'DELETED_LOG';
    } else if (isPast) {
      statusKey = 'NOT_PA';
    } else {
      // Today and no logs yet
      statusKey = 'NOT_PA';
    }
  } else {
    // There are active logs
    if (hasMissingClockOut && isPast) {
      statusKey = 'LOG_ERROR'; // Past date with missing out
    } else if (hasMissingClockOut && isToday) {
      // Check if past auto-close time (19:00 IST)
      const now = new Date();
      const istHours = (now.getUTCHours() + 5.5) % 24;
      const [acH, acM] = (policy.autoCloseMissingClockOutAt || '19:00').split(':').map(Number);
      if (istHours >= acH + acM / 60) {
        statusKey = 'LOG_ERROR';
      } else if (isCurrentlyOnBreak) {
        statusKey = 'BREAK_LOG';
      } else {
        statusKey = hasManualOrRegularized ? 'CHANGED_LOG' : 'LOG_OK';
      }
    } else if (isCurrentlyOnBreak) {
      statusKey = 'BREAK_LOG';
    } else if (hasManualOrRegularized) {
      statusKey = 'CHANGED_LOG';
    } else if (workedMinutes < (policy.halfDayMinMinutes || 240)) {
      statusKey = 'LOG_ERROR'; // Illogical or under half-day minimum without leave
    } else {
      statusKey = 'LOG_OK';
    }
  }

  const meta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.NOT_PA;

  return {
    date: dateStr,
    status: meta.key,
    label: meta.label,
    color: meta.color,
    bg: meta.bg,
    text: meta.text,
    border: meta.border,
    workedMinutes,
    lateMinutes,
    breakMinutes,
    overtimeMinutes,
    shift: shift ? { id: shift._id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime, workingMinutes: shift.workingMinutes } : null,
    logs: activeLogs,
    linked: {
      holiday: holiday ? { id: holiday._id, name: holiday.name, type: holiday.type } : null,
      leave: leave ? { id: leave._id, type: leave.leaveType?.name, code: leave.leaveType?.code, paid: leave.leaveType?.paid } : null,
      remote: remote ? { id: remote._id, reason: remote.reason } : null,
    },
  };
};

/**
 * Get daily statuses for an entire month for an employee
 */
export const getEmployeeMonthDayStatuses = async (employeeId, year, month) => {
  const policy = await getCompanyPolicy();
  const numDays = new Date(year, month, 0).getDate();
  const results = [];

  for (let day = 1; day <= numDays; day++) {
    const padDay = String(day).padStart(2, '0');
    const padMonth = String(month).padStart(2, '0');
    const dateStr = `${year}-${padMonth}-${padDay}`;
    const status = await calculateDayStatus(employeeId, dateStr, { policy });
    results.push(status);
  }

  // Aggregate monthly summaries
  let totalWorkingDays = 0;
  let workedDays = 0;
  let totalWorkedMinutes = 0;
  let totalOvertimeMinutes = 0;
  let totalLateCount = 0;
  let totalHolidayCount = 0;
  let paidLeaveMinutes = 0;
  let unpaidLeaveMinutes = 0;
  let remoteWorkMinutes = 0;
  let weekOffPresentMinutes = 0;

  results.forEach((d) => {
    if (d.status === 'HOLIDAY' || d.status === 'RESTRICTED_DAY') {
      totalHolidayCount++;
    }
    if (d.status !== 'WEEK_OFF' && d.status !== 'HOLIDAY' && d.status !== 'UPCOMING') {
      totalWorkingDays++;
    }
    if (['LOG_OK', 'CHANGED_LOG', 'BREAK_LOG'].includes(d.status) || (d.workedMinutes >= 240)) {
      workedDays++;
    }
    if (d.lateMinutes > 0) {
      totalLateCount++;
    }
    totalWorkedMinutes += d.workedMinutes;
    totalOvertimeMinutes += d.overtimeMinutes;

    if (d.status === 'WEEK_OFF' && d.workedMinutes > 0) {
      weekOffPresentMinutes += d.workedMinutes;
    }
    if (d.status === 'LEAVE') {
      paidLeaveMinutes += 465;
    }
    if (d.status === 'COMPANY_OUTSIDE_LEAVE') {
      unpaidLeaveMinutes += 465;
    }
    if (d.status === 'REMOTE_WORK') {
      remoteWorkMinutes += (d.workedMinutes || 465);
    }
  });

  return {
    year,
    month,
    days: results,
    summary: {
      totalDays: numDays,
      totalWorkingDays,
      workedDays,
      holidays: totalHolidayCount,
      lateCount: totalLateCount,
      presentPercentage: totalWorkingDays > 0 ? Math.round((workedDays / totalWorkingDays) * 100) : 0,
    },
    hoursBreakdown: {
      companyWorkingHours: +( (totalWorkingDays * 7.75).toFixed(2) ),
      totalWorkedHours: +( (totalWorkedMinutes / 60).toFixed(2) ),
      otHours: +( (totalOvertimeMinutes / 60).toFixed(2) ),
      asPerPolicyHours: +( (workedDays * 7.75).toFixed(2) ),
      weekOffPresentHours: +( (weekOffPresentMinutes / 60).toFixed(2) ),
    },
    leaveAndRemote: {
      paidLeaveHours: +( (paidLeaveMinutes / 60).toFixed(2) ),
      unpaidLeaveHours: +( (unpaidLeaveMinutes / 60).toFixed(2) ),
      remoteWorkHours: +( (remoteWorkMinutes / 60).toFixed(2) ),
    },
  };
};

/**
 * Record a new punch and synchronize with the daily Attendance record
 */
export const recordPunch = async ({ employeeId, type, time, source = 'web', note = '', changedBy = null, isDemo = false }) => {
  const punchTime = time ? new Date(time) : new Date();
  const dateStr = toISTDateString(punchTime);

  const log = await AttendanceLog.create({
    employee: employeeId,
    date: dateStr,
    type,
    time: punchTime,
    source,
    note,
    changedBy,
    isDemo,
  });

  // Synchronize daily Attendance record for backwards compatibility
  const dayLogs = await AttendanceLog.find({
    employee: employeeId,
    date: dateStr,
    isDeleted: false,
  }).sort({ time: 1 });

  const inLog = dayLogs.find((l) => l.type === 'in');
  const outLogs = dayLogs.filter((l) => l.type === 'out');
  const lastOut = outLogs.length > 0 ? outLogs[outLogs.length - 1] : null;

  const targetDateUTC = new Date(`${dateStr}T00:00:00.000Z`);

  let attendance = await Attendance.findOne({
    employee: employeeId,
    date: targetDateUTC,
  });

  if (!attendance) {
    attendance = new Attendance({
      employee: employeeId,
      date: targetDateUTC,
      status: 'present',
      source,
      isDemo,
    });
  } else if (isDemo) {
    attendance.isDemo = true;
  }

  if (inLog) attendance.checkIn = inLog.time;
  if (lastOut) attendance.checkOut = lastOut.time;

  // Calculate day status using the engine
  const statusInfo = await calculateDayStatus(employeeId, dateStr);
  attendance.workHours = +( (statusInfo.workedMinutes / 60).toFixed(2) );
  attendance.lateMinutes = statusInfo.lateMinutes;

  if (statusInfo.status === 'LOG_OK' || statusInfo.status === 'CHANGED_LOG') {
    attendance.status = statusInfo.lateMinutes > 0 ? 'late' : 'present';
  } else if (statusInfo.status === 'LOG_ERROR') {
    attendance.status = 'half_day';
  }

  await attendance.save();

  return { log, dayStatus: statusInfo };
};
