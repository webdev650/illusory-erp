import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { Employee } from '../models/Employee.js';
import { Warning } from '../models/Warning.js';
import { MoodCheckin } from '../models/MoodCheckin.js';
import * as dashboardService from '../services/hrmsDashboard.service.js';

// In-Memory 60-second Cache
const CACHE_TTL_MS = 60 * 1000;
const dashboardCache = new Map();

const getCacheKey = (endpoint, user, query) => {
  const role = user?.role?.key || 'anon';
  const userId = user?._id?.toString() || 'anon';
  const qStr = JSON.stringify(query || {});
  return `${endpoint}:${role}:${userId}:${qStr}`;
};

const withCache = async (key, fetcher) => {
  const now = Date.now();
  const cached = dashboardCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const data = await fetcher();
  dashboardCache.set(key, { timestamp: now, data });
  return data;
};

export const invalidateDashboardCache = () => {
  dashboardCache.clear();
};

/**
 * Resolve employee scope based on user role
 */
const resolveScope = async (req) => {
  const roleKey = req.user?.role?.key;

  // Employees have NO access to aggregate HRMS analytics
  if (roleKey === 'employee') {
    throw { statusCode: 403, message: 'Access denied. HRMS Dashboard requires HR or Management permissions.' };
  }

  // Super Admin, Admin, and HR have organization-wide visibility
  if (['super_admin', 'admin', 'hr'].includes(roleKey)) {
    return { isHRAdmin: true, teamEmployeeIds: null };
  }

  // Project Managers have access to their direct reports
  if (roleKey === 'project_manager') {
    const managerEmpId = req.user?.employee?._id || req.user?.employee;
    if (!managerEmpId) {
      return { isHRAdmin: false, teamEmployeeIds: [] };
    }
    const reports = await Employee.find(
      { 'employment.reportingManager': managerEmpId, isDeleted: false },
      '_id'
    );
    const teamIds = [managerEmpId.toString(), ...reports.map((r) => r._id.toString())];
    return { isHRAdmin: false, teamEmployeeIds: teamIds };
  }

  // Default fallback
  throw { statusCode: 403, message: 'Forbidden' };
};

export const getStatusSummary = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { department, employeeType } = req.query;
    const cacheKey = getCacheKey('status-summary', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getStatusSummary({ teamEmployeeIds, department, employeeType })
    );
    return sendSuccess(res, data, 'Status summary retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getOverviewStats = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { department, employeeType } = req.query;
    const cacheKey = getCacheKey('overview-stats', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getOverviewStats({ teamEmployeeIds, department, employeeType })
    );
    return sendSuccess(res, data, 'Overview stats retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getStrength = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const months = parseInt(req.query.months, 10) || 12;
    const cacheKey = getCacheKey('strength', req.user, { months });

    const data = await withCache(cacheKey, () =>
      dashboardService.getStrengthTrends({ teamEmployeeIds, months })
    );
    return sendSuccess(res, data, 'Strength trends retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getNetGrowth = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const months = parseInt(req.query.months, 10) || 12;
    const cacheKey = getCacheKey('net-growth', req.user, { months });

    const data = await withCache(cacheKey, () =>
      dashboardService.getNetGrowth({ teamEmployeeIds, months })
    );
    return sendSuccess(res, data, 'Net growth trends retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getDistribution = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { groupBy = 'department', crossBy = 'gender', department, employeeType } = req.query;
    const cacheKey = getCacheKey('distribution', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getEmployeeDistribution({ teamEmployeeIds, groupBy, crossBy, department, employeeType })
    );
    return sendSuccess(res, data, 'Employee distribution retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getLeaveTypes = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { from, to, department } = req.query;
    const cacheKey = getCacheKey('leave-types', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getLeaveTypesSummary({ teamEmployeeIds, from, to, department })
    );
    return sendSuccess(res, data, 'Leave types summary retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getLateReasons = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { from, to, department } = req.query;
    const cacheKey = getCacheKey('late-reasons', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getLateReasonsSummary({ teamEmployeeIds, from, to, department })
    );
    return sendSuccess(res, data, 'Late reasons summary retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getGrowth = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const months = parseInt(req.query.months, 10) || 12;
    const cacheKey = getCacheKey('growth', req.user, { months });

    const data = await withCache(cacheKey, () =>
      dashboardService.getEmployeeGrowth({ teamEmployeeIds, months })
    );
    return sendSuccess(res, data, 'Employee growth comparison retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getLateAttendance = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { from, to, department } = req.query;
    const cacheKey = getCacheKey('late-attendance', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getLateAttendanceAnalytics({ teamEmployeeIds, from, to, department })
    );
    return sendSuccess(res, data, 'Late attendance analytics retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getLateToday = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { department } = req.query;
    const cacheKey = getCacheKey('late-today', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getLateTodayList({ teamEmployeeIds, department })
    );
    return sendSuccess(res, data, 'Late arrivals today retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getNoLeave = async (req, res, next) => {
  try {
    const { teamEmployeeIds } = await resolveScope(req);
    const { month, year, department } = req.query;
    const cacheKey = getCacheKey('no-leave', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getNoLeaveEmployees({ teamEmployeeIds, month, year, department })
    );
    return sendSuccess(res, data, 'No leave employees retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const getMoodSummary = async (req, res, next) => {
  try {
    const { isHRAdmin, teamEmployeeIds } = await resolveScope(req);
    const { from, to } = req.query;
    const cacheKey = getCacheKey('mood-summary', req.user, req.query);

    const data = await withCache(cacheKey, () =>
      dashboardService.getMoodSummary({ teamEmployeeIds, from, to, isHRAdmin })
    );
    return sendSuccess(res, data, 'Mood summary retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

/**
 * Record Daily Mood Check-in (Voluntary)
 */
export const recordMoodCheckin = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id || req.user.employee;
    if (!employeeId) {
      return sendError(res, 'No employee record linked to user', 400);
    }
    const { mood, note } = req.body;
    if (!mood) {
      return sendError(res, 'Mood is required', 400);
    }

    // Set today's date in IST truncated
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const checkin = await MoodCheckin.findOneAndUpdate(
      { employee: employeeId, date: today },
      { $set: { mood, note: note || '' } },
      { upsert: true, new: true }
    );

    invalidateDashboardCache();
    return sendSuccess(res, checkin, 'Mood check-in recorded');
  } catch (err) {
    next(err);
  }
};

/**
 * Warnings & PIP CRUD
 */
export const getWarnings = async (req, res, next) => {
  try {
    const { isHRAdmin, teamEmployeeIds } = await resolveScope(req);
    const query = {};
    if (!isHRAdmin && teamEmployeeIds) {
      query.employee = { $in: teamEmployeeIds };
    }
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;

    const warnings = await Warning.find(query)
      .populate('employee', 'employeeId personal.firstName personal.lastName personal.photo employment.department')
      .populate('issuedBy', 'email')
      .sort({ createdAt: -1 });

    return sendSuccess(res, warnings, 'Warnings retrieved');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
};

export const createWarning = async (req, res, next) => {
  try {
    const roleKey = req.user?.role?.key;
    if (!['super_admin', 'admin', 'hr'].includes(roleKey)) {
      return sendError(res, 'Only HR or Admins can issue Warnings/PIPs', 403);
    }

    const { employee, type = 'warning', title, reason, improvementPlan, endDate } = req.body;
    if (!employee || !reason) {
      return sendError(res, 'Employee and reason are required', 400);
    }

    const warning = await Warning.create({
      employee,
      type,
      title: title || (type === 'pip' ? 'Performance Improvement Plan' : 'Formal Warning'),
      reason,
      issuedBy: req.user._id,
      improvementPlan: improvementPlan || '',
      endDate: endDate ? new Date(endDate) : null,
      status: 'active',
    });

    invalidateDashboardCache();
    return sendSuccess(res, warning, `${type === 'pip' ? 'PIP' : 'Warning'} created successfully`, 201);
  } catch (err) {
    next(err);
  }
};

export const closeWarning = async (req, res, next) => {
  try {
    const roleKey = req.user?.role?.key;
    if (!['super_admin', 'admin', 'hr'].includes(roleKey)) {
      return sendError(res, 'Only HR or Admins can close Warnings/PIPs', 403);
    }

    const { id } = req.params;
    const { resolutionNote } = req.body;

    const warning = await Warning.findByIdAndUpdate(
      id,
      { $set: { status: 'closed', resolutionNote: resolutionNote || 'Resolved' } },
      { new: true }
    );

    if (!warning) {
      return sendError(res, 'Warning not found', 404);
    }

    invalidateDashboardCache();
    return sendSuccess(res, warning, 'Status updated to closed');
  } catch (err) {
    next(err);
  }
};
