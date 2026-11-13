import { z } from 'zod';
import TimeEntry from '../models/TimeEntry.js';
import Timesheet from '../models/Timesheet.js';
import ActiveTimer from '../models/ActiveTimer.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Employee from '../models/Employee.js';
import Client from '../models/Client.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import {
  toKolkataDateOnly,
  getWeekBounds,
  recalculateTaskAndProjectTime,
  getExpectedWeekHours,
} from '../services/activity.service.js';
import { notifyEmployee } from '../services/notification.service.js';

// Zod schemas
const timeEntrySchema = z.object({
  employee: z.string().optional(), // Defaults to req.user.employee
  date: z.string().min(1, 'Date is required'),
  project: z.string().nullable().optional(),
  task: z.string().nullable().optional(),
  category: z
    .enum([
      'project_work',
      'meeting',
      'review',
      'learning',
      'admin',
      'internal',
      'support',
      'other',
    ])
    .optional()
    .default('project_work'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  durationMinutes: z
    .number()
    .min(5, 'Minimum duration is 5 minutes')
    .max(960, 'Maximum duration is 16 hours (960 minutes)'),
  isBillable: z.boolean().optional().default(true),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

/**
 * Helper to check team read permission
 */
const canReadEmployeeTime = async (req, targetEmployeeId) => {
  const targetIdStr = targetEmployeeId?.toString();
  const userEmpId = req.user?.employee?.toString();

  // Own time
  if (userEmpId && userEmpId === targetIdStr) return true;

  // Super Admin / Admin / HR with readAll
  if (
    req.permissions?.includes('*') ||
    req.permissions?.includes('activity.readAll') ||
    ['super_admin', 'admin', 'hr'].includes(req.userRole)
  ) {
    return true;
  }

  // Manager or PM with readTeam
  if (req.permissions?.includes('activity.readTeam') && userEmpId) {
    // 1. Check if user is reporting manager
    const emp = await Employee.findById(targetIdStr).select('employment.reportingManager');
    if (emp?.employment?.reportingManager?.toString() === userEmpId) return true;

    // 2. Check if user is PM of a project target belongs to
    const managedProjects = await Project.find({
      projectManager: userEmpId,
      isDeleted: false,
      'members.employee': targetIdStr,
    }).select('_id');

    if (managedProjects.length > 0) return true;
  }

  return false;
};

// ==========================================
// 1. TIME ENTRIES CRUD
// ==========================================

/**
 * Get time entries with rich filters
 * GET /api/v1/activity/entries
 */
export const getTimeEntries = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 100,
      employee,
      project,
      task,
      startDate,
      endDate,
      category,
      billable,
      status,
    } = req.query;

    const query = { isDeleted: false };

    // Scoped employee filter
    const userEmpId = req.user?.employee?.toString();
    const hasReadAll =
      req.permissions?.includes('*') ||
      req.permissions?.includes('activity.readAll') ||
      ['super_admin', 'admin', 'hr'].includes(req.userRole);

    if (employee) {
      const allowed = await canReadEmployeeTime(req, employee);
      if (!allowed) {
        return sendError(res, 'Access denied. You cannot view time logs for this employee.', 403);
      }
      query.employee = employee;
    } else if (!hasReadAll) {
      if (!userEmpId) {
        return sendSuccess(res, 'No entries found', { entries: [], pagination: { total: 0 } });
      }
      query.employee = userEmpId;
    }

    if (project) query.project = project;
    if (task) query.task = task;
    if (category) query.category = category;
    if (billable !== undefined) query.isBillable = billable === 'true';
    if (status) query.status = status;

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = toKolkataDateOnly(startDate);
      if (endDate) {
        const endD = toKolkataDateOnly(endDate);
        endD.setHours(23, 59, 59, 999);
        query.date.$lte = endD;
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await TimeEntry.countDocuments(query);

    const entries = await TimeEntry.find(query)
      .populate('employee', 'personal.firstName personal.lastName employment.designation personal.photo')
      .populate('project', 'projectCode name client')
      .populate('task', 'taskCode title')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    return sendSuccess(res, 'Time entries retrieved successfully', {
      entries,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new time entry
 * POST /api/v1/activity/entries
 */
export const createTimeEntry = async (req, res, next) => {
  try {
    const parsed = timeEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    const employeeId = parsed.data.employee || req.user?.employee;
    if (!employeeId) {
      return sendError(res, 'Employee ID required or user must have an associated employee record', 400);
    }

    // Permission check for creating on behalf of someone else
    if (employeeId.toString() !== req.user?.employee?.toString()) {
      const canEditAll =
        req.permissions?.includes('*') ||
        req.permissions?.includes('activity.editAll') ||
        ['super_admin', 'admin'].includes(req.userRole);
      if (!canEditAll) {
        return sendError(res, 'You can only log time for yourself', 403);
      }
    }

    // Date validations
    const entryDate = toKolkataDateOnly(parsed.data.date);
    const today = toKolkataDateOnly(new Date());

    if (entryDate > today) {
      return sendError(res, 'Cannot log time for future dates', 400);
    }

    // Backdating check (max 14 days without activity.editAll)
    const fourteenDaysAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    if (entryDate < fourteenDaysAgo) {
      const canEditAll =
        req.permissions?.includes('*') ||
        req.permissions?.includes('activity.editAll') ||
        ['super_admin', 'admin'].includes(req.userRole);
      if (!canEditAll) {
        return sendError(
          res,
          'Backdating beyond 14 days is not permitted. Please request an administrator or reopen timesheet.',
          403
        );
      }
    }

    // Check project membership (if project provided)
    if (parsed.data.project) {
      const project = await Project.findOne({ _id: parsed.data.project, isDeleted: false });
      if (!project) return sendError(res, 'Project not found', 404);

      const isManager = project.projectManager?.toString() === employeeId.toString();
      const isMember = (project.members || []).some(
        (m) => m.employee?.toString() === employeeId.toString()
      );
      const isPrivileged =
        req.permissions?.includes('*') || ['super_admin', 'admin'].includes(req.userRole);

      if (!isManager && !isMember && !isPrivileged) {
        return sendError(res, 'You can only log time for projects you are assigned to as a member or manager', 403);
      }
    }

    // Check 16 hour total daily limit
    const existingDayEntries = await TimeEntry.find({
      employee: employeeId,
      date: entryDate,
      isDeleted: false,
    });
    const dayTotalMinutes = existingDayEntries.reduce((sum, e) => sum + e.durationMinutes, 0);

    if (dayTotalMinutes + parsed.data.durationMinutes > 960) {
      const remainingMinutes = Math.max(0, 960 - dayTotalMinutes);
      return sendError(
        res,
        `Daily time limit of 16 hours exceeded for ${entryDate.toLocaleDateString('en-IN')}. Remaining capacity: ${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m`,
        400
      );
    }

    // Check if timesheet for this week already approved/submitted
    const { weekStart } = getWeekBounds(entryDate);
    const timesheet = await Timesheet.findOne({ employee: employeeId, weekStart });
    if (timesheet && ['submitted', 'approved'].includes(timesheet.status)) {
      const canEditAll =
        req.permissions?.includes('*') ||
        req.permissions?.includes('activity.editAll') ||
        ['super_admin', 'admin'].includes(req.userRole);
      if (!canEditAll) {
        return sendError(
          res,
          `Timesheet for the week of ${weekStart.toLocaleDateString('en-IN')} is ${timesheet.status} and locked.`,
          403
        );
      }
    }

    const entry = await TimeEntry.create({
      ...parsed.data,
      employee: employeeId,
      date: entryDate,
      timesheet: timesheet?._id || null,
      status: timesheet?.status === 'submitted' ? 'submitted' : timesheet?.status === 'approved' ? 'approved' : 'draft',
      source: 'manual',
    });

    // Recalculate logged hours for task and project
    await recalculateTaskAndProjectTime(entry.task, entry.project);

    return sendSuccess(res, 'Time logged successfully', entry, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update time entry
 * PUT /api/v1/activity/entries/:id
 */
export const updateTimeEntry = async (req, res, next) => {
  try {
    const entry = await TimeEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!entry) return sendError(res, 'Time entry not found', 404);

    // Permission check
    const isOwner = entry.employee.toString() === req.user?.employee?.toString();
    const canEditAll =
      req.permissions?.includes('*') ||
      req.permissions?.includes('activity.editAll') ||
      ['super_admin', 'admin'].includes(req.userRole);

    if (!isOwner && !canEditAll) {
      return sendError(res, 'You do not have permission to edit this time entry', 403);
    }

    // Lock check
    if (['submitted', 'approved'].includes(entry.status) && !canEditAll) {
      return sendError(res, `This entry is part of a ${entry.status} timesheet and is locked.`, 403);
    }

    const parsed = timeEntrySchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    const oldTaskId = entry.task;
    const oldProjectId = entry.project;

    Object.assign(entry, parsed.data);
    if (parsed.data.date) {
      entry.date = toKolkataDateOnly(parsed.data.date);
    }

    await entry.save();

    // Recalculate task & project
    await recalculateTaskAndProjectTime(entry.task || oldTaskId, entry.project || oldProjectId);

    return sendSuccess(res, 'Time entry updated successfully', entry);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete time entry (soft delete)
 * DELETE /api/v1/activity/entries/:id
 */
export const deleteTimeEntry = async (req, res, next) => {
  try {
    const entry = await TimeEntry.findOne({ _id: req.params.id, isDeleted: false });
    if (!entry) return sendError(res, 'Time entry not found', 404);

    const isOwner = entry.employee.toString() === req.user?.employee?.toString();
    const canEditAll =
      req.permissions?.includes('*') ||
      req.permissions?.includes('activity.editAll') ||
      ['super_admin', 'admin'].includes(req.userRole);

    if (!isOwner && !canEditAll) {
      return sendError(res, 'You do not have permission to delete this entry', 403);
    }

    if (['submitted', 'approved'].includes(entry.status) && !canEditAll) {
      return sendError(res, `Cannot delete an entry from a ${entry.status} timesheet`, 403);
    }

    entry.isDeleted = true;
    await entry.save();

    await recalculateTaskAndProjectTime(entry.task, entry.project);

    return sendSuccess(res, 'Time entry deleted successfully', null);
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk copy entries (e.g. copy yesterday to today)
 * POST /api/v1/activity/entries/bulk
 */
export const bulkCreateTimeEntries = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.body;
    if (!fromDate || !toDate) {
      return sendError(res, 'fromDate and toDate are required', 400);
    }

    const employeeId = req.user?.employee;
    if (!employeeId) return sendError(res, 'Employee ID required', 400);

    const sourceDate = toKolkataDateOnly(fromDate);
    const targetDate = toKolkataDateOnly(toDate);

    const sourceEntries = await TimeEntry.find({
      employee: employeeId,
      date: sourceDate,
      isDeleted: false,
    });

    if (sourceEntries.length === 0) {
      return sendError(res, `No time entries found on ${sourceDate.toLocaleDateString('en-IN')}`, 404);
    }

    const createdEntries = [];
    for (const src of sourceEntries) {
      const cloned = await TimeEntry.create({
        employee: employeeId,
        date: targetDate,
        project: src.project,
        task: src.task,
        category: src.category,
        description: src.description,
        durationMinutes: src.durationMinutes,
        isBillable: src.isBillable,
        source: 'manual',
        status: 'draft',
      });
      createdEntries.push(cloned);
      await recalculateTaskAndProjectTime(cloned.task, cloned.project);
    }

    return sendSuccess(
      res,
      `Copied ${createdEntries.length} entries to ${targetDate.toLocaleDateString('en-IN')}`,
      { count: createdEntries.length }
    );
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. LIVE ACTIVE TIMER
// ==========================================

/**
 * Get running timer for logged in employee
 * GET /api/v1/activity/timer
 */
export const getActiveTimer = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee;
    if (!employeeId) return sendSuccess(res, 'No active timer', null);

    const timer = await ActiveTimer.findOne({ employee: employeeId })
      .populate('project', 'projectCode name client')
      .populate('task', 'taskCode title')
      .lean();

    return sendSuccess(res, 'Active timer status', timer);
  } catch (err) {
    next(err);
  }
};

/**
 * Start running timer
 * POST /api/v1/activity/timer/start
 */
export const startActiveTimer = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee;
    if (!employeeId) {
      return sendError(res, 'Employee record required to start timer', 400);
    }

    const { project, task, description } = req.body;

    // Check if a timer is already running
    const existing = await ActiveTimer.findOne({ employee: employeeId })
      .populate('project', 'projectCode name')
      .populate('task', 'taskCode title');

    if (existing) {
      return sendError(
        res,
        'Another timer is already running. Please stop or discard it first.',
        409,
        { activeTimer: existing }
      );
    }

    const timer = await ActiveTimer.create({
      employee: employeeId,
      project: project || null,
      task: task || null,
      description: description?.trim() || '',
      startedAt: new Date(),
    });

    return sendSuccess(res, 'Timer started', timer, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Stop running timer and record as TimeEntry
 * POST /api/v1/activity/timer/stop
 */
export const stopActiveTimer = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee;
    if (!employeeId) return sendError(res, 'Employee record required', 400);

    const timer = await ActiveTimer.findOne({ employee: employeeId });
    if (!timer) return sendError(res, 'No active timer found to stop', 404);

    const now = new Date();
    const diffMinutes = Math.round((now.getTime() - new Date(timer.startedAt).getTime()) / (1000 * 60));
    const durationMinutes = Math.max(5, Math.min(diffMinutes, 960)); // Min 5 min, max 16 hrs

    const today = toKolkataDateOnly(now);
    const { weekStart } = getWeekBounds(today);

    // Check if timesheet is already locked
    const timesheet = await Timesheet.findOne({ employee: employeeId, weekStart });
    const isLocked = timesheet && ['submitted', 'approved'].includes(timesheet.status);

    const entry = await TimeEntry.create({
      employee: employeeId,
      date: today,
      project: timer.project,
      task: timer.task,
      category: 'project_work',
      description: timer.description || 'Session recorded via live timer',
      startTime: timer.startedAt,
      endTime: now,
      durationMinutes,
      source: 'timer',
      status: isLocked ? timesheet.status : 'draft',
      timesheet: timesheet?._id || null,
    });

    // Delete active timer
    await ActiveTimer.deleteOne({ _id: timer._id });

    // Recalculate task & project
    await recalculateTaskAndProjectTime(entry.task, entry.project);

    return sendSuccess(res, `Timer stopped. Logged ${durationMinutes} minutes.`, {
      entry,
      durationMinutes,
      isForgotten: diffMinutes > 720, // flagged if ran over 12 hours
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Discard running timer without saving
 * DELETE /api/v1/activity/timer
 */
export const discardActiveTimer = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee;
    if (!employeeId) return sendError(res, 'Employee record required', 400);

    await ActiveTimer.deleteOne({ employee: employeeId });
    return sendSuccess(res, 'Timer discarded successfully', null);
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. TIMESHEET SUBMISSION & APPROVALS
// ==========================================

/**
 * Get my past timesheets
 * GET /api/v1/activity/timesheets/my
 */
export const getMyTimesheets = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee;
    if (!employeeId) return sendSuccess(res, 'My timesheets', []);

    const timesheets = await Timesheet.find({ employee: employeeId })
      .populate('reviewedBy', 'personal.firstName personal.lastName')
      .sort({ weekStart: -1 })
      .limit(26)
      .lean();

    return sendSuccess(res, 'Timesheets retrieved', timesheets);
  } catch (err) {
    next(err);
  }
};

/**
 * Get timesheet detail for a specific week
 * GET /api/v1/activity/timesheets/:weekStart
 */
export const getTimesheetByWeek = async (req, res, next) => {
  try {
    const employeeId = req.query.employeeId || req.user?.employee;
    if (!employeeId) return sendError(res, 'Employee ID required', 400);

    const allowed = await canReadEmployeeTime(req, employeeId);
    if (!allowed) return sendError(res, 'Access denied', 403);

    const weekStartDate = toKolkataDateOnly(req.params.weekStart);
    const { weekStart, weekEnd } = getWeekBounds(weekStartDate);

    // Fetch or initialize timesheet doc
    let timesheet = await Timesheet.findOne({ employee: employeeId, weekStart })
      .populate('reviewedBy', 'personal.firstName personal.lastName')
      .lean();

    // Fetch entries for this week
    const entries = await TimeEntry.find({
      employee: employeeId,
      date: { $gte: weekStart, $lte: weekEnd },
      isDeleted: false,
    })
      .populate('project', 'projectCode name client')
      .populate('task', 'taskCode title')
      .sort({ date: 1, createdAt: 1 })
      .lean();

    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const billableMinutes = entries
      .filter((e) => e.isBillable)
      .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

    const expectedHours = await getExpectedWeekHours(employeeId, weekStart, weekEnd);

    // Group entries day by day (Monday = index 0 ... Sunday = index 6)
    const days = [];
    const cur = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const dateStr = cur.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const dayDate = new Date(cur);
      const dayEntries = entries.filter(
        (e) =>
          new Date(e.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === dateStr
      );
      const dayTotalMinutes = dayEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

      days.push({
        date: dayDate,
        dateString: dateStr,
        dayOfWeek: i + 1, // 1 = Mon ... 7 = Sun
        totalMinutes: dayTotalMinutes,
        entries: dayEntries,
      });

      cur.setDate(cur.getDate() + 1);
    }

    return sendSuccess(res, 'Weekly timesheet details', {
      timesheet: timesheet || {
        employee: employeeId,
        weekStart,
        weekEnd,
        status: 'draft',
        totalMinutes,
        billableMinutes,
      },
      entries,
      days,
      summary: {
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        billableMinutes,
        billableHours: Math.round((billableMinutes / 60) * 10) / 10,
        expectedHours,
        utilizationPercent:
          expectedHours > 0 ? Math.round(((totalMinutes / 60) / expectedHours) * 100) : 100,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Submit weekly timesheet for manager approval
 * POST /api/v1/activity/timesheets/:weekStart/submit
 */
export const submitTimesheet = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee;
    if (!employeeId) return sendError(res, 'Employee record required to submit timesheet', 400);

    const weekStartDate = toKolkataDateOnly(req.params.weekStart);
    const { weekStart, weekEnd } = getWeekBounds(weekStartDate);

    // Business Rule: Submit allowed from Friday onwards or any time after week ends
    const now = new Date();
    const todayIST = toKolkataDateOnly(now);
    const currentWeekBounds = getWeekBounds(todayIST);

    // If it's the current active week, check day of week
    if (weekStart.getTime() === currentWeekBounds.weekStart.getTime()) {
      const todayDayOfWeek = todayIST.getDay(); // 5 = Friday, 6 = Saturday, 0 = Sunday
      if (todayDayOfWeek !== 5 && todayDayOfWeek !== 6 && todayDayOfWeek !== 0) {
        return sendError(
          res,
          'Weekly timesheet can be submitted from Friday 00:00 IST onward or after the week closes.',
          400
        );
      }
    }

    // Load entries for this week
    const entries = await TimeEntry.find({
      employee: employeeId,
      date: { $gte: weekStart, $lte: weekEnd },
      isDeleted: false,
    });

    if (entries.length === 0) {
      return sendError(res, 'Cannot submit an empty timesheet without any logged time', 400);
    }

    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
    const billableMinutes = entries
      .filter((e) => e.isBillable)
      .reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

    // Expected hours check
    const expectedHours = await getExpectedWeekHours(employeeId, weekStart, weekEnd);
    const loggedHours = totalMinutes / 60;
    const isUnder80Percent = expectedHours > 0 && loggedHours < expectedHours * 0.8;

    // Determine approver: Reporting manager or fallback to HR
    const emp = await Employee.findById(employeeId).populate('employment.reportingManager');
    const approverEmployeeId = emp?.employment?.reportingManager?._id;

    // Upsert Timesheet document
    let timesheet = await Timesheet.findOne({ employee: employeeId, weekStart });
    if (!timesheet) {
      timesheet = new Timesheet({
        employee: employeeId,
        weekStart,
        weekEnd,
      });
    }

    timesheet.totalMinutes = totalMinutes;
    timesheet.billableMinutes = billableMinutes;
    timesheet.status = 'submitted';
    timesheet.submittedAt = new Date();
    timesheet.reviewComment = '';
    await timesheet.save();

    // Lock all entries to 'submitted'
    await TimeEntry.updateMany(
      { employee: employeeId, date: { $gte: weekStart, $lte: weekEnd }, isDeleted: false },
      { status: 'submitted', timesheet: timesheet._id }
    );

    // Create Approval Request
    const approval = await ApprovalRequest.create({
      type: 'timesheet',
      referenceModel: 'Timesheet',
      referenceId: timesheet._id,
      requestedBy: employeeId,
      title: `Timesheet (${loggedHours.toFixed(1)} hrs) - Week of ${weekStart.toLocaleDateString('en-IN')}`,
      metadata: {
        totalHours: loggedHours.toFixed(1),
        expectedHours,
        isUnderExpected: isUnder80Percent,
        billableHours: (billableMinutes / 60).toFixed(1),
        weekStart,
        weekEnd,
      },
      steps: [
        {
          order: 1,
          title: 'Manager Timesheet Review',
          approverEmployee: approverEmployeeId || null,
          approverRole: approverEmployeeId ? undefined : 'hr',
          status: 'pending',
        },
      ],
      currentStep: 1,
      status: 'pending',
    });

    timesheet.approvalRequest = approval._id;
    await timesheet.save();

    // Notify Approver
    if (approverEmployeeId) {
      await notifyEmployee(approverEmployeeId, {
        title: `Timesheet Submitted: ${emp?.personal?.firstName || 'Team Member'}`,
        message: `${emp?.personal?.firstName} submitted a timesheet for ${loggedHours.toFixed(1)} hrs (Week of ${weekStart.toLocaleDateString('en-IN')}).`,
        link: `/tracker?tab=approvals`,
        type: 'approval',
      });
    }

    // Recalculate tasks and projects
    for (const e of entries) {
      await recalculateTaskAndProjectTime(e.task, e.project);
    }

    return sendSuccess(res, 'Timesheet submitted for approval', {
      timesheet,
      warning: isUnder80Percent
        ? `Logged hours (${loggedHours.toFixed(1)} hrs) are under 80% of expected capacity (${expectedHours} hrs).`
        : null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get pending timesheets for approvers (Managers & HR)
 * GET /api/v1/activity/timesheets/pending
 */
export const getPendingTimesheets = async (req, res, next) => {
  try {
    const userEmpId = req.user?.employee?.toString();
    const isHrOrAdmin =
      req.permissions?.includes('*') ||
      req.permissions?.includes('activity.readAll') ||
      ['super_admin', 'admin', 'hr'].includes(req.userRole);

    let query = { status: 'submitted' };

    if (!isHrOrAdmin) {
      if (!userEmpId) {
        return sendSuccess(res, 'Pending timesheets', []);
      }

      // Find employees reporting to this user or members of projects this user leads
      const directReports = await Employee.find({
        'employment.reportingManager': userEmpId,
      }).select('_id');
      const directReportIds = directReports.map((d) => d._id);

      const managedProjects = await Project.find({
        projectManager: userEmpId,
        isDeleted: false,
      }).select('members.employee');
      const projectMemberIds = [];
      managedProjects.forEach((p) => {
        (p.members || []).forEach((m) => {
          if (m.employee) projectMemberIds.push(m.employee);
        });
      });

      const allowedEmployeeIds = [...new Set([...directReportIds, ...projectMemberIds])];
      query.employee = { $in: allowedEmployeeIds };
    }

    const timesheets = await Timesheet.find(query)
      .populate('employee', 'personal.firstName personal.lastName employment.designation personal.photo')
      .populate('approvalRequest')
      .sort({ submittedAt: -1 })
      .lean();

    return sendSuccess(res, 'Pending timesheets retrieved', timesheets);
  } catch (err) {
    next(err);
  }
};

/**
 * Reopen an approved/submitted timesheet (Admin / HR with activity.editAll)
 * POST /api/v1/activity/timesheets/:id/reopen
 */
export const reopenTimesheet = async (req, res, next) => {
  try {
    const timesheet = await Timesheet.findById(req.params.id);
    if (!timesheet) return sendError(res, 'Timesheet not found', 404);

    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return sendError(res, 'Reason for reopening timesheet is required', 400);
    }

    timesheet.status = 'reopened';
    timesheet.reviewComment = `Reopened: ${reason.trim()}`;
    await timesheet.save();

    // Unlock entries
    await TimeEntry.updateMany(
      { timesheet: timesheet._id, isDeleted: false },
      { status: 'draft' }
    );

    // Cancel existing approval request if pending
    if (timesheet.approvalRequest) {
      await ApprovalRequest.findByIdAndUpdate(timesheet.approvalRequest, {
        status: 'cancelled',
      });
    }

    await notifyEmployee(timesheet.employee, {
      title: 'Timesheet Reopened for Revision',
      message: `Your timesheet for week of ${new Date(timesheet.weekStart).toLocaleDateString('en-IN')} was reopened. Reason: "${reason.trim()}"`,
      link: '/tracker',
      type: 'timesheet',
    });

    return sendSuccess(res, 'Timesheet reopened successfully', timesheet);
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. REPORTS & UTILIZATION
// ==========================================

/**
 * Report by Project
 * GET /api/v1/activity/reports/by-project
 */
export const getReportByProject = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const canViewCost =
      req.permissions?.includes('*') || req.permissions?.includes('activity.viewCost');

    const matchQuery = { isDeleted: false, project: { $ne: null } };
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = toKolkataDateOnly(startDate);
      if (endDate) matchQuery.date.$lte = toKolkataDateOnly(endDate);
    }

    const aggregation = await TimeEntry.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$project',
          totalMinutes: { $sum: '$durationMinutes' },
          billableMinutes: {
            $sum: { $cond: [{ $eq: ['$isBillable', true] }, '$durationMinutes', 0] },
          },
          entryCount: { $sum: 1 },
        },
      },
      { $sort: { totalMinutes: -1 } },
    ]);

    await Project.populate(aggregation, {
      path: '_id',
      select: 'projectCode name client status budget costToDate',
      populate: { path: 'client', select: 'name' },
    });

    const report = aggregation
      .filter((a) => a._id)
      .map((a) => {
        const p = a._id;
        const totalHours = Math.round((a.totalMinutes / 60) * 10) / 10;
        const billableHours = Math.round((a.billableMinutes / 60) * 10) / 10;
        const billableRatio = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

        const row = {
          projectId: p._id,
          projectCode: p.projectCode,
          projectName: p.name,
          clientName: p.client?.name || 'Internal',
          status: p.status,
          totalHours,
          billableHours,
          nonBillableHours: Math.round((totalHours - billableHours) * 10) / 10,
          billableRatio,
          entriesCount: a.entryCount,
        };

        if (canViewCost) {
          row.budgetPaise = p.budget?.amount || 0;
          row.budgetINR = Math.round((p.budget?.amount || 0) / 100);
          row.costToDatePaise = p.costToDate || 0;
          row.costToDateINR = Math.round((p.costToDate || 0) / 100);
        }

        return row;
      });

    return sendSuccess(res, 'Hours by project report', report);
  } catch (err) {
    next(err);
  }
};

/**
 * Report by Employee (Utilization & Billability)
 * GET /api/v1/activity/reports/by-employee
 */
export const getReportByEmployee = async (req, res, next) => {
  try {
    const { startDate, endDate, department } = req.query;

    const matchQuery = { isDeleted: false };
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = toKolkataDateOnly(startDate);
      if (endDate) matchQuery.date.$lte = toKolkataDateOnly(endDate);
    }

    const aggregation = await TimeEntry.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$employee',
          totalMinutes: { $sum: '$durationMinutes' },
          billableMinutes: {
            $sum: { $cond: [{ $eq: ['$isBillable', true] }, '$durationMinutes', 0] },
          },
          entryCount: { $sum: 1 },
        },
      },
      { $sort: { totalMinutes: -1 } },
    ]);

    await Employee.populate(aggregation, {
      path: '_id',
      select: 'personal.firstName personal.lastName employment.designation employment.department',
      populate: { path: 'employment.department', select: 'name code' },
    });

    const report = aggregation
      .filter((a) => a._id)
      .map((a) => {
        const emp = a._id;
        const totalHours = Math.round((a.totalMinutes / 60) * 10) / 10;
        const billableHours = Math.round((a.billableMinutes / 60) * 10) / 10;
        const billablePercent = totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0;

        return {
          employeeId: emp._id,
          name: `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim(),
          designation: emp.employment?.designation || 'Specialist',
          department: emp.employment?.department?.name || 'General',
          totalHours,
          billableHours,
          nonBillableHours: Math.round((totalHours - billableHours) * 10) / 10,
          billablePercent,
          entryCount: a.entryCount,
        };
      });

    return sendSuccess(res, 'Hours by employee report', report);
  } catch (err) {
    next(err);
  }
};

/**
 * Report by Category (Breakdown across tasks, meetings, review, etc.)
 * GET /api/v1/activity/reports/by-category
 */
export const getReportByCategory = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const matchQuery = { isDeleted: false };
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = toKolkataDateOnly(startDate);
      if (endDate) matchQuery.date.$lte = toKolkataDateOnly(endDate);
    }

    const aggregation = await TimeEntry.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$category',
          totalMinutes: { $sum: '$durationMinutes' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalMinutes: -1 } },
    ]);

    const report = aggregation.map((a) => ({
      category: a._id || 'other',
      label: (a._id || 'other').replace('_', ' ').toUpperCase(),
      totalHours: Math.round((a.totalMinutes / 60) * 10) / 10,
      count: a.count,
    }));

    return sendSuccess(res, 'Hours by category report', report);
  } catch (err) {
    next(err);
  }
};

/**
 * Missing Timesheets report (who has not submitted for a given week)
 * GET /api/v1/activity/reports/missing-timesheets
 */
export const getMissingTimesheetsReport = async (req, res, next) => {
  try {
    const { weekStart } = req.query;
    const weekStartDate = weekStart ? toKolkataDateOnly(weekStart) : getWeekBounds().weekStart;

    const allActiveEmployees = await Employee.find({
      status: 'active',
      isDeleted: false,
    }).select('personal.firstName personal.lastName personal.officialEmail employment.designation employment.department');

    const submittedTimesheets = await Timesheet.find({
      weekStart: weekStartDate,
      status: { $in: ['submitted', 'approved'] },
    }).select('employee status totalMinutes');

    const submittedEmpIds = new Set(submittedTimesheets.map((t) => t.employee.toString()));

    const missing = allActiveEmployees
      .filter((e) => !submittedEmpIds.has(e._id.toString()))
      .map((e) => ({
        employeeId: e._id,
        name: `${e.personal?.firstName || ''} ${e.personal?.lastName || ''}`.trim(),
        email: e.personal?.officialEmail,
        designation: e.employment?.designation,
      }));

    return sendSuccess(res, 'Missing timesheets report', {
      weekStart: weekStartDate,
      missingCount: missing.length,
      missing,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Export Time Entries to CSV
 * GET /api/v1/activity/export
 */
export const exportActivityData = async (req, res, next) => {
  try {
    const { startDate, endDate, format = 'csv' } = req.query;
    const canViewCost =
      req.permissions?.includes('*') || req.permissions?.includes('activity.viewCost');

    const matchQuery = { isDeleted: false };
    if (startDate || endDate) {
      matchQuery.date = {};
      if (startDate) matchQuery.date.$gte = toKolkataDateOnly(startDate);
      if (endDate) matchQuery.date.$lte = toKolkataDateOnly(endDate);
    }

    const entries = await TimeEntry.find(matchQuery)
      .populate('employee', 'personal.firstName personal.lastName employment.designation')
      .populate('project', 'projectCode name')
      .populate('task', 'taskCode title')
      .sort({ date: -1 })
      .lean();

    const headers = [
      'Date',
      'Employee',
      'Designation',
      'Project Code',
      'Project Name',
      'Task Code',
      'Task Title',
      'Category',
      'Description',
      'Hours',
      'Billable',
      'Status',
    ];

    const rows = entries.map((e) => [
      new Date(e.date).toLocaleDateString('en-IN'),
      `"${e.employee?.personal?.firstName || ''} ${e.employee?.personal?.lastName || ''}"`,
      `"${e.employee?.employment?.designation || ''}"`,
      e.project?.projectCode || 'N/A',
      `"${e.project?.name || 'Internal'}"`,
      e.task?.taskCode || 'N/A',
      `"${(e.task?.title || '').replace(/"/g, '""')}"`,
      e.category,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      (e.durationMinutes / 60).toFixed(2),
      e.isBillable ? 'Yes' : 'No',
      e.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=illusory-timesheet-export-${Date.now()}.csv`);
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};

