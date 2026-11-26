import mongoose from 'mongoose';
import { Shift } from '../models/Shift.js';
import { ShiftAssignment } from '../models/ShiftAssignment.js';
import { AttendancePolicy, DEFAULT_UNVERIFIED_SETTINGS } from '../models/AttendancePolicy.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Attendance } from '../models/Attendance.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { PartialDayRequest } from '../models/PartialDayRequest.js';
import { LatePenaltyRecord } from '../models/LatePenaltyRecord.js';
import { CriticalDate } from '../models/CriticalDate.js';

export const STATUS_CONFIG = {
  LOG_OK: {
    key: 'LOG_OK',
    label: 'Log Ok',
    color: '#10B981', // Emerald 500
    bg: '#ECFDF5',
    text: '#065F46',
    border: '#A7F3D0',
  },
  HALF_DAY: {
    key: 'HALF_DAY',
    label: 'Half Day',
    color: '#EAB308', // Yellow 500
    bg: '#FEFCE8',
    text: '#854D0E',
    border: '#FDE047',
  },
  EARLY_EXIT: {
    key: 'EARLY_EXIT',
    label: 'Early Exit',
    color: '#F97316', // Orange 500
    bg: '#FFF7ED',
    text: '#9A3412',
    border: '#FDBA74',
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
  UNAUTHORIZED_ABSENCE: {
    key: 'UNAUTHORIZED_ABSENCE',
    label: 'Unauthorized Absence',
    color: '#DC2626', // Red 600
    bg: '#FEF2F2',
    text: '#991B1B',
    border: '#F87171',
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
 * Convert UTC Date to YYYY-MM-DD string in Asia/Kolkata timezone
 */
export const toISTDateString = (dateObj) => {
  const d = new Date(dateObj);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(d.getTime() + istOffsetMs);
  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get decimal IST hour from a Date object (e.g. 14.5 for 14:30)
 */
export const getISTDecimalHour = (dateObj) => {
  const d = new Date(dateObj);
  const istOffsetMinutes = 5.5 * 60;
  const totalMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + istOffsetMinutes) % (24 * 60);
  return totalMinutes / 60;
};

/**
 * Fetch or initialize global attendance policy with Rule Book defaults
 */
export const getCompanyPolicy = async () => {
  let policy = await AttendancePolicy.findOne({ isDefault: true });
  if (!policy) {
    policy = await AttendancePolicy.create({
      name: 'Default Studio Policy',
      lateAfter: 0,
      lateAfterTime: '10:00',
      graceMinutes: 0,
      halfDayMinMinutes: 240,
      fullDayMinMinutes: 465,
      autoCloseMissingClockOutAt: '19:00',
      maxBackdateDays: 15,
      weekOffDays: [0], // Sunday
      breakMinutes: 60,
      latePenaltyMode: 'flag_for_review',
      lateThresholds: {
        tier1_monitorMax: 2,
        tier2_halfDayMin: 3,
        tier2_halfDayMax: 4,
        tier3_fullDayMin: 5,
      },
      maxRegularizationsPerMonth: 2,
      accrualStartRule: 'from_joining_month',
      accrualProrateFirstMonth: true,
      accrueDuringProbation: false,
      minServiceMonths: 6,
      minServiceFrom: 'joining',
      partialDayEnabled: false,
      compOffExpiryDays: 30,
      compOffPreApprovalRequired: true,
      breakPunchingMandatory: false,
      sandwichMode: 'off',
      sandwichExemptionNoticeDays: 30,
      annualLeaveMaxCarryDays: 4,
      casualLeaveForwardMode: 'lapse',
      attendanceSource: 'web',
      unverifiedSettings: DEFAULT_UNVERIFIED_SETTINGS,
      isDefault: true,
    });
  }
  return policy;
};

/**
 * Resolve effective shift for an employee on a target date
 */
export const resolveEmployeeShift = async (employeeId, dateStr) => {
  const assignments = await ShiftAssignment.find({
    employee: employeeId,
    startDate: { $lte: new Date(`${dateStr}T23:59:59.999Z`) },
    $or: [{ endDate: null }, { endDate: { $gte: new Date(`${dateStr}T00:00:00.000Z`) } }],
  })
    .populate('shift')
    .sort({ type: 1, createdAt: -1 });

  const specialAssignment = assignments.find((a) => a.type === 'special');
  if (specialAssignment) {
    return { shift: specialAssignment.shift, type: 'special' };
  }

  const defaultAssignment = assignments.find((a) => a.type === 'default');
  if (defaultAssignment) {
    return { shift: defaultAssignment.shift, type: 'default' };
  }

  // System fallback: 10:00 AM to 6:45 PM
  let systemDefaultShift = await Shift.findOne({ isDefault: true });
  if (!systemDefaultShift) {
    systemDefaultShift = await Shift.create({
      name: 'Default Studio Shift',
      code: 'DEFAULT_SHIFT',
      startTime: '10:00',
      endTime: '18:45',
      breakMinutes: 60,
      workingMinutes: 465,
      halfDayHours: 4,
      fullDayHours: 7.75,
      isDefault: true,
    });
  }

  return { shift: systemDefaultShift, type: 'system_default' };
};

/**
 * Calculate single day status for employee + date
 * Following Rule Book Precedence Hierarchy:
 * Level 1: Full-Day Approved Leave
 * Level 2: Holiday
 * Level 3: Scheduled Week-off (Sunday)
 * Level 4: Approved Remote Work (WFH)
 * Level 5: Approved Half-Day Leave with clock cut-offs (2:00 PM)
 * Level 6: Regular Working Day with clock cut-offs (6:00 PM, 6:30 PM, 6:45 PM) & minutes worked
 * Level 7: No Punches (Unauthorized Absence vs NOT P/A)
 */
export const calculateDayStatus = async (employeeId, dateInput, options = {}) => {
  const dateStr = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? dateInput
    : toISTDateString(dateInput);

  const policy = options.policy || (await getCompanyPolicy());
  const { shift } = await resolveEmployeeShift(employeeId, dateStr);

  const dayStartUTC = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEndUTC = new Date(`${dateStr}T23:59:59.999Z`);
  const dayOfWeek = dayStartUTC.getUTCDay(); // 0 = Sunday

  const todayStr = toISTDateString(new Date());
  const isPast = dateStr < todayStr;
  const isToday = dateStr === todayStr;
  const isFuture = dateStr > todayStr;

  // 1. Check Holiday
  const holiday = await Holiday.findOne({
    date: { $gte: dayStartUTC, $lte: dayEndUTC },
  });

  // 2. Check Week Off
  const isWeekOff = (policy.weekOffDays || [0]).includes(dayOfWeek);

  // 3. Check Leave Request
  const leave = await LeaveRequest.findOne({
    employee: employeeId,
    status: { $in: ['approved', 'unauthorized'] },
    fromDate: { $lte: dayEndUTC },
    toDate: { $gte: dayStartUTC },
  }).populate('leaveType');

  // 4. Check Remote Work Request
  const remote = await RemoteWorkRequest.findOne({
    employee: employeeId,
    status: 'approved',
    fromDate: { $lte: dayEndUTC },
    toDate: { $gte: dayStartUTC },
  });

  // 5. Check Approved Excuses (Regularization or Partial Day)
  const approvedRegularization = await AttendanceRegularization.findOne({
    employee: employeeId,
    date: { $gte: dayStartUTC, $lte: dayEndUTC },
    status: 'approved',
  });

  const approvedPartialDay = await PartialDayRequest.findOne({
    employee: employeeId,
    date: { $gte: dayStartUTC, $lte: dayEndUTC },
    status: 'approved',
  });

  const hasApprovedExcuse = !!(approvedRegularization || approvedPartialDay);

  // 6. Fetch Logs
  const allLogs = await AttendanceLog.find({
    employee: employeeId,
    date: dateStr,
  }).sort({ time: 1 });

  const activeLogs = allLogs.filter((l) => !l.isDeleted);
  const hasDeletedLog = allLogs.some((l) => l.isDeleted);
  const hasManualOrRegularized = activeLogs.some((l) => ['manual', 'bulk', 'regularized'].includes(l.source));

  // Compute worked time, breaks, late, OT
  let workedMinutes = 0;
  let breakMinutes = 0;
  let lateMinutes = 0;
  let overtimeMinutes = 0;
  let hasMissingClockOut = false;
  let isCurrentlyOnBreak = false;
  let firstInISTHour = null;
  let lastOutISTHour = null;

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

  // Calculate gross work duration & clock times
  if (inPunches.length > 0) {
    const firstIn = inPunches[0].time;
    firstInISTHour = getISTDecimalHour(firstIn);
    const lastOut = outPunches.length > 0 ? outPunches[outPunches.length - 1].time : null;

    if (lastOut) {
      lastOutISTHour = getISTDecimalHour(lastOut);
      const grossMinutes = Math.max(0, Math.round((lastOut.getTime() - firstIn.getTime()) / 60000));
      workedMinutes = Math.max(0, grossMinutes - breakMinutes);
    } else {
      hasMissingClockOut = true;
      if (isToday) {
        const nowMs = Date.now();
        const grossMinutes = Math.max(0, Math.round((nowMs - firstIn.getTime()) / 60000));
        workedMinutes = Math.max(0, grossMinutes - breakMinutes);
      }
    }

    // Late calculation rule:
    // Only count on working days where a punch-in after the late time was recorded.
    // Late entries MUST NOT count on days with approved leave, a holiday, a week-off, approved remote work or an approved excuse.
    const isLateExempt = !!(leave || holiday || isWeekOff || remote || hasApprovedExcuse);

    if (!isLateExempt && shift && shift.startTime) {
      const [shH, shM] = (policy.lateAfterTime || shift.startTime || '10:00').split(':').map(Number);
      const shiftStartMs = new Date(dayStartUTC).getTime() + (shH * 60 + shM - 330) * 60000;
      const graceMs = (policy.graceMinutes || 0) * 60000;
      const arrivalMs = firstIn.getTime();

      if (arrivalMs > shiftStartMs + graceMs) {
        lateMinutes = Math.max(0, Math.round((arrivalMs - shiftStartMs) / 60000));
      }
    }
  }

  // Overtime calculation
  const targetWorkingMinutes = shift ? shift.workingMinutes || 465 : 465;
  if (isWeekOff || holiday) {
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
  } else if (leave && !leave.isHalfDay) {
    // Level 1: Full-Day Approved Leave
    statusKey = leave.leaveType?.paid === false ? 'COMPANY_OUTSIDE_LEAVE' : 'LEAVE';
    workedMinutes = 0;
  } else if (holiday) {
    // Level 2: Holiday
    if (activeLogs.length > 0 && workedMinutes >= (policy.halfDayMinMinutes || 240)) {
      statusKey = 'LOG_OK';
    } else {
      statusKey = holiday.type === 'restricted' ? 'RESTRICTED_DAY' : 'HOLIDAY';
    }
  } else if (isWeekOff) {
    // Level 3: Week Off (Sunday)
    if (activeLogs.length > 0 && workedMinutes >= (policy.halfDayMinMinutes || 240)) {
      statusKey = 'LOG_OK';
    } else {
      statusKey = 'WEEK_OFF';
    }
  } else if (remote) {
    // Level 4: Remote Work (WFH)
    statusKey = 'REMOTE_WORK';
    if (workedMinutes === 0) {
      workedMinutes = policy.creditFullHoursAutomatically !== false ? targetWorkingMinutes : 0;
    }
  } else if (leave && leave.isHalfDay) {
    // Level 5: Approved Half-Day Leave with 2:00 PM (14.0 IST) cut-offs
    if (activeLogs.length === 0) {
      statusKey = 'LEAVE'; // No punch on half-day leave = counts as full day leave
    } else if (firstInISTHour !== null && firstInISTHour <= 14.0 && (lastOutISTHour === null || lastOutISTHour >= 14.0)) {
      statusKey = 'HALF_DAY';
    } else if (firstInISTHour !== null && firstInISTHour > 14.0) {
      // Arriving after 2:00 PM for first-half leave counts as full-day leave per Rule Book
      statusKey = 'LEAVE';
    } else if (lastOutISTHour !== null && lastOutISTHour < 14.0) {
      // Leaving before 2:00 PM for second-half leave counts as full-day leave per Rule Book
      statusKey = 'LEAVE';
    } else {
      statusKey = 'HALF_DAY';
    }
  } else if (activeLogs.length === 0) {
    // Level 7: No Punches on a Working Day
    if (hasDeletedLog) {
      statusKey = 'DELETED_LOG';
    } else if (leave && leave.status === 'unauthorized') {
      statusKey = 'UNAUTHORIZED_ABSENCE';
    } else if (isPast) {
      statusKey = 'NOT_PA';
    } else {
      statusKey = 'NOT_PA';
    }
  } else {
    // Level 6: Regular Working Day with active punches & clock cut-offs
    if (hasMissingClockOut && isPast) {
      statusKey = 'LOG_ERROR'; // Past date with missing out
    } else if (hasMissingClockOut && isToday) {
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
    } else if (hasManualOrRegularized && workedMinutes >= (policy.fullDayMinMinutes || 465)) {
      statusKey = 'CHANGED_LOG';
    } else if (lastOutISTHour !== null && lastOutISTHour < 18.0) {
      // RULE BOOK CUT-OFF: Leaving before 6:00 PM (18:00 IST) without approved leave counts as a HALF DAY
      // (Even if workedMinutes >= 240, e.g. 250 minutes worked, clock exit before 18:00 -> HALF_DAY)
      statusKey = 'HALF_DAY';
    } else if (lastOutISTHour !== null && lastOutISTHour >= 18.0 && lastOutISTHour < 18.5) {
      // RULE BOOK CUT-OFF: Leaving between 6:00 PM and 6:30 PM is recorded as "Early exit" for policy tracking
      statusKey = 'EARLY_EXIT';
    } else if (workedMinutes < (policy.halfDayMinMinutes || 240)) {
      statusKey = 'LOG_ERROR'; // Under 240 minutes minimum without approved leave
    } else if (workedMinutes < (policy.fullDayMinMinutes || 465)) {
      statusKey = 'HALF_DAY';
    } else {
      statusKey = hasManualOrRegularized ? 'CHANGED_LOG' : 'LOG_OK';
    }
  }

  const meta = STATUS_CONFIG[statusKey] || STATUS_CONFIG.NOT_PA;

  // Check critical date warning
  const criticalDateObj = await CriticalDate.findOne({
    date: { $gte: dayStartUTC, $lte: dayEndUTC },
  });

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
    isLate: lateMinutes > 0,
    hasApprovedExcuse,
    criticalWarning: criticalDateObj ? `Critical Date Scheduled: ${criticalDateObj.title} (${criticalDateObj.type})` : null,
    linked: {
      holiday: holiday ? { id: holiday._id, name: holiday.name, type: holiday.type } : null,
      leave: leave ? { id: leave._id, type: leave.leaveType?.name, code: leave.leaveType?.code, paid: leave.leaveType?.paid, isHalfDay: leave.isHalfDay } : null,
      remote: remote ? { id: remote._id, reason: remote.reason } : null,
      regularization: approvedRegularization ? { id: approvedRegularization._id } : null,
      partialDay: approvedPartialDay ? { id: approvedPartialDay._id } : null,
      criticalDate: criticalDateObj ? { id: criticalDateObj._id, title: criticalDateObj.title } : null,
    },
  };
};

/**
 * Get monthly late count for an employee in a calendar month
 * Excuses, leaves, holidays, week-offs, and remote days are strictly excluded.
 */
export const getEmployeeMonthlyLateCount = async (employeeId, year, month) => {
  const policy = await getCompanyPolicy();
  const numDays = new Date(year, month, 0).getDate();
  let lateDaysCount = 0;

  for (let day = 1; day <= numDays; day++) {
    const padDay = String(day).padStart(2, '0');
    const padMonth = String(month).padStart(2, '0');
    const dateStr = `${year}-${padMonth}-${padDay}`;
    const status = await calculateDayStatus(employeeId, dateStr, { policy });
    if (status.isLate) {
      lateDaysCount++;
    }
  }

  return lateDaysCount;
};

/**
 * Synchronize late penalty record for a day according to Rule Book tiers
 * Entries 1 and 2: monitoring only
 * Entries 3 and 4: half-day deduction
 * Entry 5+: full-day deduction
 * Default mode: 'flag_for_review' -> status 'pending_hr_review' (no auto deduction)
 */
export const syncLatePenaltyForDay = async (employeeId, dateStr, checkInTime, lateMinutes, policy) => {
  if (!lateMinutes || lateMinutes <= 0) return null;

  const [yearStr, monthStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  // Count existing late entries up to this date in the month
  const existingRecords = await LatePenaltyRecord.find({
    employee: employeeId,
    year,
    month,
    dateStr: { $lt: dateStr },
    isExcused: false,
  });

  const entryNumberInMonth = existingRecords.length + 1;

  let deductionTier = 'none';
  if (entryNumberInMonth >= 5) {
    deductionTier = 'full_day';
  } else if (entryNumberInMonth >= 3) {
    deductionTier = 'half_day';
  }

  const penaltyMode = policy.latePenaltyMode || 'flag_for_review';

  const record = await LatePenaltyRecord.findOneAndUpdate(
    { employee: employeeId, dateStr },
    {
      employee: employeeId,
      date: new Date(`${dateStr}T00:00:00.000Z`),
      dateStr,
      year,
      month,
      checkInTime,
      lateMinutes,
      entryNumberInMonth,
      deductionTier,
      penaltyMode,
      status: 'pending_hr_review',
      $push: {
        auditHistory: {
          action: 'RECORDED_LATE_ENTRY',
          performedAt: new Date(),
          reason: `Late entry #${entryNumberInMonth} (${lateMinutes} min late, tier: ${deductionTier})`,
        },
      },
    },
    { new: true, upsert: true }
  );

  return record;
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
  let earlyExitCount = 0;

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
    if (d.isLate) {
      totalLateCount++;
    }
    if (d.status === 'EARLY_EXIT') {
      earlyExitCount++;
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
      earlyExitCount,
      presentPercentage: totalWorkingDays > 0 ? Math.round((workedDays / totalWorkingDays) * 100) : 0,
      lateWarningNotice: totalLateCount === 2 ? 'Next late entry may count as a half-day deduction per company Rule Book' : null,
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
export const recordPunch = async ({
  employeeId,
  type,
  time,
  source = 'web',
  note = '',
  changedBy = null,
  ipAddress = '',
  deviceInfo = '',
  isDemo = false,
}) => {
  const punchTime = time ? new Date(time) : new Date();
  const dateStr = toISTDateString(punchTime);

  const log = await AttendanceLog.create({
    employee: employeeId,
    date: dateStr,
    type,
    time: punchTime,
    source,
    note,
    ipAddress,
    deviceInfo,
    changedBy,
    isDemo,
  });

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

  const policy = await getCompanyPolicy();
  const statusInfo = await calculateDayStatus(employeeId, dateStr, { policy });
  attendance.workHours = +( (statusInfo.workedMinutes / 60).toFixed(2) );
  attendance.lateMinutes = statusInfo.lateMinutes;

  if (statusInfo.status === 'LOG_OK' || statusInfo.status === 'CHANGED_LOG') {
    attendance.status = statusInfo.lateMinutes > 0 ? 'late' : 'present';
  } else if (statusInfo.status === 'HALF_DAY') {
    attendance.status = 'half_day';
  } else if (statusInfo.status === 'EARLY_EXIT') {
    attendance.status = 'present';
  } else if (statusInfo.status === 'LOG_ERROR') {
    attendance.status = 'half_day';
  }

  await attendance.save();

  // If check-in resulted in late minutes, sync LatePenaltyRecord (pending review)
  if (type === 'in' && statusInfo.isLate) {
    await syncLatePenaltyForDay(employeeId, dateStr, punchTime, statusInfo.lateMinutes, policy);
  }

  return { log, dayStatus: statusInfo };
};
