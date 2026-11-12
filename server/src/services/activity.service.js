import TimeEntry from '../models/TimeEntry.js';
import Timesheet from '../models/Timesheet.js';
import Task from '../models/Task.js';
import Project from '../models/Project.js';
import Shift from '../models/Shift.js';
import Holiday from '../models/Holiday.js';
import LeaveRequest from '../models/LeaveRequest.js';

/**
 * Normalizes any date to Asia/Kolkata midnight (00:00:00.000)
 */
export const toKolkataDateOnly = (date) => {
  const d = new Date(date);
  const kolkataStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
  return new Date(`${kolkataStr}T00:00:00.000Z`);
};

/**
 * Returns Monday (00:00:00.000) and Sunday (23:59:59.999) in Asia/Kolkata for any given date
 */
export const getWeekBounds = (date = new Date()) => {
  const d = toKolkataDateOnly(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { weekStart: monday, weekEnd: sunday };
};

/**
 * Recalculates Task and Project loggedHours and Project costToDate
 * Called after TimeEntry creation, update, deletion, or Timesheet approval
 */
export const recalculateTaskAndProjectTime = async (taskId, projectId) => {
  try {
    // 1. Recalculate Task
    if (taskId) {
      const taskEntries = await TimeEntry.find({
        task: taskId,
        isDeleted: false,
        status: { $in: ['submitted', 'approved'] },
      }).select('durationMinutes');

      const totalTaskMinutes = taskEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
      const taskLoggedHours = Math.round((totalTaskMinutes / 60) * 10) / 10;

      await Task.findByIdAndUpdate(taskId, { loggedHours: taskLoggedHours });
    }

    // 2. Recalculate Project
    if (projectId) {
      const project = await Project.findById(projectId).select('members');
      if (project) {
        const projectEntries = await TimeEntry.find({
          project: projectId,
          isDeleted: false,
          status: { $in: ['submitted', 'approved'] },
        }).select('employee durationMinutes');

        const totalProjMinutes = projectEntries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
        const projLoggedHours = Math.round((totalProjMinutes / 60) * 10) / 10;

        // Build member billing rate map (in paise per hour)
        const rateMap = {};
        for (const m of project.members || []) {
          if (m.employee) {
            rateMap[m.employee.toString()] = m.billingRatePerHour || 0;
          }
        }

        // Calculate costToDate in integer paise
        let totalCostPaise = 0;
        for (const entry of projectEntries) {
          const empId = entry.employee?.toString();
          const ratePerHour = rateMap[empId] || 0;
          const entryCost = Math.round(((entry.durationMinutes || 0) / 60) * ratePerHour);
          totalCostPaise += entryCost;
        }

        await Project.findByIdAndUpdate(projectId, {
          loggedHours: projLoggedHours,
          costToDate: totalCostPaise,
        });
      }
    }
  } catch (err) {
    console.error('Error in recalculateTaskAndProjectTime:', err);
  }
};

/**
 * Computes expected working hours for an employee for a specific week
 * Takes into account Shift working hours, public holidays, and approved leaves
 */
export const getExpectedWeekHours = async (employeeId, weekStart, weekEnd) => {
  try {
    // Default shift: 8 hrs/day, Monday-Friday (5 days = 40 hours)
    let standardWorkingDays = [1, 2, 3, 4, 5];
    let dailyHours = 8;

    const defaultShift = await Shift.findOne({ isDefault: true });
    if (defaultShift) {
      if (Array.isArray(defaultShift.workingDays) && defaultShift.workingDays.length > 0) {
        standardWorkingDays = defaultShift.workingDays;
      }
      dailyHours = defaultShift.fullDayHours || 8;
    }

    // 1. Base expected hours
    let expectedHours = standardWorkingDays.length * dailyHours;

    // 2. Holidays during this week (only those falling on standard working days)
    const holidays = await Holiday.find({
      date: { $gte: weekStart, $lte: weekEnd },
    });

    for (const h of holidays) {
      const hDay = new Date(h.date).getDay();
      if (standardWorkingDays.includes(hDay)) {
        expectedHours -= dailyHours;
      }
    }

    // 3. Approved leaves for this employee during this week
    if (employeeId) {
      const leaves = await LeaveRequest.find({
        employee: employeeId,
        status: 'approved',
        fromDate: { $lte: weekEnd },
        toDate: { $gte: weekStart },
      });

      for (const l of leaves) {
        const leaveDays = l.days || 1;
        const leaveDeduction = l.isHalfDay ? dailyHours * 0.5 : dailyHours * leaveDays;
        expectedHours -= leaveDeduction;
      }
    }

    return Math.max(0, expectedHours);
  } catch (err) {
    console.warn('Error calculating expected week hours, defaulting to 40', err);
    return 40;
  }
};
