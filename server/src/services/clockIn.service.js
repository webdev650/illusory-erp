import crypto from 'crypto';
import { ClockInIntent } from '../models/ClockInIntent.js';
import { LateReasonOption, DEFAULT_LATE_REASONS } from '../models/LateReasonOption.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { Holiday } from '../models/Holiday.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { Employee } from '../models/Employee.js';
import {
  getCompanyPolicy,
  toISTDateString,
  recordPunch,
  calculateDayStatus,
  syncLatePenaltyForDay,
} from './dayStatus.service.js';
import { getClientIp, parseDeviceLabel } from './session.service.js';
import { logger } from '../utils/logger.js';

/**
 * Seeds default late reasons in MongoDB if collection is empty
 */
export const seedLateReasons = async () => {
  try {
    const count = await LateReasonOption.countDocuments();
    if (count === 0) {
      await LateReasonOption.insertMany(DEFAULT_LATE_REASONS);
      logger.info('Default late reason options seeded into MongoDB');
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed seeding default late reasons');
  }
};

/**
 * Retrieves active late reasons sorted by order
 */
export const getActiveLateReasons = async () => {
  await seedLateReasons();
  return LateReasonOption.find({ isActive: true }).sort({ order: 1 }).lean();
};

/**
 * Computes whether a punch-in timestamp is late according to policy settings and server time in Asia/Kolkata.
 */
export const checkClockInLateness = async (employeeId, checkTime = new Date()) => {
  const policy = await getCompanyPolicy();
  const dateStr = toISTDateString(checkTime);

  // Time in IST
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = istFormatter.formatToParts(checkTime);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const currentMinutes = hour * 60 + minute;

  // Resolved policy threshold (e.g. '10:00')
  const [lateH, lateM] = (policy.lateAfterTime || '10:00').split(':').map(Number);
  const graceMinutes = policy.graceMinutes || 0;
  const cutoffMinutes = lateH * 60 + lateM + graceMinutes;

  // If clock in time <= cutoffMinutes (e.g. <= 600 min -> 10:00 AM), it is on time
  if (currentMinutes <= cutoffMinutes) {
    return {
      isLate: false,
      lateMinutes: 0,
      dateStr,
      policy,
      serverTime: checkTime,
    };
  }

  // Clock in at 10:01 AM or later: check if excused by holiday, week-off, approved leave, or approved remote work
  const checkDayOfWeek = new Date(`${dateStr}T12:00:00.000Z`).getDay();
  const isWeekOff = (policy.weekOffDays || [0]).includes(checkDayOfWeek);
  if (isWeekOff) {
    return { isLate: false, lateMinutes: 0, dateStr, policy, serverTime: checkTime, excusedReason: 'week_off' };
  }

  const isHoliday = await Holiday.findOne({ date: dateStr });
  if (isHoliday) {
    return { isLate: false, lateMinutes: 0, dateStr, policy, serverTime: checkTime, excusedReason: 'holiday' };
  }

  const approvedLeave = await LeaveRequest.findOne({
    employee: employeeId,
    status: 'approved',
    fromDate: { $lte: dateStr },
    toDate: { $gte: dateStr },
    isHalfDay: false,
  });
  if (approvedLeave) {
    return { isLate: false, lateMinutes: 0, dateStr, policy, serverTime: checkTime, excusedReason: 'approved_leave' };
  }

  const checkDateObj = new Date(`${dateStr}T12:00:00.000Z`);
  const approvedRemote = await RemoteWorkRequest.findOne({
    employee: employeeId,
    status: 'approved',
    fromDate: { $lte: checkDateObj },
    toDate: { $gte: checkDateObj },
  });
  if (approvedRemote) {
    return { isLate: false, lateMinutes: 0, dateStr, policy, serverTime: checkTime, excusedReason: 'remote_work' };
  }

  const lateMinutes = currentMinutes - cutoffMinutes;
  return {
    isLate: true,
    lateMinutes,
    dateStr,
    policy,
    serverTime: checkTime,
  };
};

/**
 * Initiates clock-in. If on-time, records punch immediately.
 * If late, creates a 10-minute ClockInIntent and throws 409 LATE_REASON_REQUIRED.
 */
export const initiateClockIn = async ({ employeeId, userId, req, forceServerTime = null }) => {
  const serverTime = forceServerTime || new Date();
  const dateStr = toISTDateString(serverTime);

  // Check if employee has attendance tracking enabled
  const emp = await Employee.findById(employeeId);
  if (!emp) {
    const err = new Error('Employee record not found');
    err.statusCode = 404;
    throw err;
  }

  // Idempotency check: block clocking in twice on the same day
  const existingIn = await AttendanceLog.findOne({
    employee: employeeId,
    date: dateStr,
    type: 'in',
    isDeleted: false,
  });

  if (existingIn) {
    const err = new Error('You have already clocked in for today.');
    err.statusCode = 400;
    err.code = 'ALREADY_CLOCKED_IN';
    throw err;
  }

  const latenessCheck = await checkClockInLateness(employeeId, serverTime);

  // On-time (or excused): save punch immediately
  if (!latenessCheck.isLate) {
    const ip = req ? getClientIp(req) : '';
    const userAgent = req?.headers ? req.headers['user-agent'] || '' : '';
    const device = parseDeviceLabel(userAgent);

    const result = await recordPunch({
      employeeId,
      type: 'in',
      time: serverTime,
      source: 'web',
      note: '',
      changedBy: userId,
      ipAddress: ip,
      deviceInfo: device,
    });

    return {
      status: 'clocked_in',
      isLate: false,
      log: result.log,
      dayStatus: result.dayStatus,
    };
  }

  // Late: create 10-minute ClockInIntent and return 409
  const intentId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from intent creation
  const ip = req ? getClientIp(req) : '';
  const userAgent = req?.headers ? req.headers['user-agent'] || '' : '';
  const device = parseDeviceLabel(userAgent);

  await ClockInIntent.create({
    intentId,
    employee: employeeId,
    user: userId,
    date: dateStr,
    serverTime,
    lateMinutes: latenessCheck.lateMinutes,
    ip,
    userAgent,
    device,
    expiresAt,
  });

  const reasons = await getActiveLateReasons();
  const reminderText =
    latenessCheck.policy?.lateReminderText ||
    'Late entries are tracked monthly. Please check the attendance rule book.';

  const lateError = new Error('Late clock-in detected. Please select a valid reason.');
  lateError.statusCode = 409;
  lateError.code = 'LATE_REASON_REQUIRED';
  lateError.data = {
    intentId,
    serverTime,
    lateMinutes: latenessCheck.lateMinutes,
    expiresAt,
    reasons,
    reminderText,
  };
  throw lateError;
};

/**
 * Submits the late reason and creates the AttendanceLog using the exact timestamp
 * from the ClockInIntent (the moment of the first button press).
 */
export const submitLateClockIn = async ({ intentId, reasonKey, note, userId, req }) => {
  if (!intentId) {
    const err = new Error('intentId is required');
    err.statusCode = 400;
    throw err;
  }

  const intent = await ClockInIntent.findOne({ intentId });
  if (!intent) {
    const err = new Error(
      'Your clock-in session has expired or was not found. Please click Clock In again to restart with fresh server time.'
    );
    err.statusCode = 410;
    err.code = 'INTENT_EXPIRED';
    throw err;
  }

  // Check 10-minute expiry
  if (new Date() > new Date(intent.expiresAt)) {
    await ClockInIntent.deleteOne({ intentId });
    const err = new Error(
      'Your 10-minute clock-in session has expired. Please click Clock In again to restart with fresh server time.'
    );
    err.statusCode = 410;
    err.code = 'INTENT_EXPIRED';
    throw err;
  }

  // Validate reason key against active options
  const reasons = await getActiveLateReasons();
  const reason = reasons.find((r) => r.key === reasonKey);
  if (!reason) {
    const err = new Error('Invalid late reason selected. Please choose a reason from the list.');
    err.statusCode = 400;
    throw err;
  }

  // Validate note requirements
  const trimmedNote = (note || '').trim();
  if (reason.requiresNote && trimmedNote.length === 0) {
    const err = new Error(`A note is required when selecting "${reason.label}".`);
    err.statusCode = 400;
    throw err;
  }

  if (trimmedNote.length > 300) {
    const err = new Error('Note must be 300 characters or fewer.');
    err.statusCode = 400;
    throw err;
  }

  // Idempotency: verify employee didn't already clock in while form was open
  const existingIn = await AttendanceLog.findOne({
    employee: intent.employee,
    date: intent.date,
    type: 'in',
    isDeleted: false,
  });

  if (existingIn) {
    await ClockInIntent.deleteOne({ intentId });
    return {
      status: 'clocked_in',
      isLate: true,
      log: existingIn,
      message: 'Already clocked in.',
    };
  }

  // Create the AttendanceLog with FROZEN server time from intent
  const punchTime = intent.serverTime;
  const log = await AttendanceLog.create({
    employee: intent.employee,
    date: intent.date,
    type: 'in',
    time: punchTime,
    source: 'web',
    lateMinutes: intent.lateMinutes,
    lateReasonKey: reason.key,
    lateReasonLabel: `${reason.emoji} ${reason.label}`,
    lateNote: trimmedNote,
    ip: intent.ip,
    device: intent.device,
    ipAddress: intent.ip,
    deviceInfo: intent.device,
    changedBy: userId,
  });

  // Calculate day status
  const policy = await getCompanyPolicy();
  const dayStatus = await calculateDayStatus(intent.employee, intent.date, { policy });

  // Sync late penalty record if configured
  if (intent.lateMinutes > 0) {
    await syncLatePenaltyForDay(intent.employee, intent.date, punchTime, intent.lateMinutes, policy);
  }

  // Calculate monthly late count for employee to show notice on 2nd late entry
  const [yearStr, monthStr] = intent.date.split('-');
  const monthPrefix = `${yearStr}-${monthStr}`;
  const monthlyLateLogs = await AttendanceLog.find({
    employee: intent.employee,
    date: { $regex: `^${monthPrefix}` },
    type: 'in',
    lateMinutes: { $gt: 0 },
    isDeleted: false,
  }).countDocuments();

  let notice = null;
  if (monthlyLateLogs === 2) {
    notice =
      'Notice: This is your 2nd late arrival this month. Rule Book Section 4.1: 3 late arrivals in a calendar month results in a half-day salary or leave deduction.';
  }

  // Delete consumed intent
  await ClockInIntent.deleteOne({ intentId });

  return {
    status: 'clocked_in',
    isLate: true,
    log,
    dayStatus,
    monthlyLateCount: monthlyLateLogs,
    notice,
  };
};
