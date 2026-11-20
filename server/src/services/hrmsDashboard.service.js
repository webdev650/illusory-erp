import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Warning } from '../models/Warning.js';
import { MoodCheckin } from '../models/MoodCheckin.js';

// Helper to convert date to IST string YYYY-MM-DD
const toISTDateString = (date) => {
  const d = new Date(date);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(d.getTime() + istOffset);
  return istTime.toISOString().split('T')[0];
};

// Base filter builder for Employee queries
const buildEmployeeFilter = ({ teamEmployeeIds, department, employeeType }) => {
  const filter = { isDeleted: false };
  if (teamEmployeeIds && teamEmployeeIds.length > 0) {
    filter._id = { $in: teamEmployeeIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  if (department) {
    filter['employment.department'] = new mongoose.Types.ObjectId(department);
  }
  if (employeeType) {
    filter['employment.employeeType'] = employeeType;
  }
  return filter;
};

/**
 * 1. Employee Status & Type Summary + Composition Rail
 */
export const getStatusSummary = async ({ teamEmployeeIds, department, employeeType }) => {
  const filter = buildEmployeeFilter({ teamEmployeeIds, department, employeeType });
  const employees = await Employee.find(filter, 'status employment.employeeType');

  const total = employees.length;
  let fullTime = 0;
  let probation = 0;
  let intern = 0;
  let notice = 0;

  for (const emp of employees) {
    const type = (emp.employment?.employeeType || '').toLowerCase();
    const status = (emp.status || '').toLowerCase();

    if (status === 'notice') notice++;
    if (status === 'probation' || type === 'probation') probation++;
    if (type === 'full-time' || type === 'full_time') fullTime++;
    if (type === 'intern') intern++;
  }

  const calcPct = (cnt) => (total > 0 ? Math.round((cnt / total) * 100) : 0);

  const composition = [
    { label: 'Full Time', count: fullTime, pct: calcPct(fullTime), color: '#6366F1' },
    { label: 'Probation', count: probation, pct: calcPct(probation), color: '#F59E0B' },
    { label: 'Intern', count: intern, pct: calcPct(intern), color: '#10B981' },
    { label: 'Notice Period', count: notice, pct: calcPct(notice), color: '#F43F5E' },
  ];

  return {
    total,
    counts: {
      total,
      fullTime,
      probation,
      intern,
      notice,
    },
    percentages: {
      fullTime: calcPct(fullTime),
      probation: calcPct(probation),
      intern: calcPct(intern),
      notice: calcPct(notice),
    },
    composition,
  };
};

/**
 * 2. Employee Overview Statistics (4 tiles: Total, Joiners, Exited, On PIP + 30-day delta)
 */
export const getOverviewStats = async ({ teamEmployeeIds, department, employeeType }) => {
  const filter = buildEmployeeFilter({ teamEmployeeIds, department, employeeType });
  const allEmployees = await Employee.find(filter, 'employment.dateOfJoining employment.dateOfLeaving status createdAt isDeleted');

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Total active employees
  const totalEmployeesCurrent = allEmployees.filter((e) => e.status !== 'inactive' && e.status !== 'terminated').length;
  // Joiners
  const joinersCurrent = allEmployees.filter(
    (e) => e.employment?.dateOfJoining && new Date(e.employment.dateOfJoining) >= d30
  ).length;
  const joinersPrev = allEmployees.filter((e) => {
    const j = e.employment?.dateOfJoining ? new Date(e.employment.dateOfJoining) : null;
    return j && j >= d60 && j < d30;
  }).length;

  // Exited
  const exitedCurrent = allEmployees.filter((e) => {
    const l = e.employment?.dateOfLeaving ? new Date(e.employment.dateOfLeaving) : null;
    return (l && l >= d30) || (['resigned', 'terminated', 'inactive'].includes(e.status) && e.updatedAt >= d30);
  }).length;
  const exitedPrev = allEmployees.filter((e) => {
    const l = e.employment?.dateOfLeaving ? new Date(e.employment.dateOfLeaving) : null;
    return (l && l >= d60 && l < d30) || (['resigned', 'terminated', 'inactive'].includes(e.status) && e.updatedAt >= d60 && e.updatedAt < d30);
  }).length;

  // PIP (Active warnings of type 'pip')
  const empIds = allEmployees.map((e) => e._id);
  const pipCurrent = await Warning.countDocuments({
    employee: { $in: empIds },
    type: 'pip',
    status: 'active',
  });
  const pipPrev = await Warning.countDocuments({
    employee: { $in: empIds },
    type: 'pip',
    createdAt: { $lt: d30 },
  });

  const getDelta = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    totalEmployees: {
      value: totalEmployeesCurrent,
      delta: getDelta(totalEmployeesCurrent, Math.max(1, totalEmployeesCurrent - (joinersCurrent - exitedCurrent))),
      progress: Math.min(100, Math.round((totalEmployeesCurrent / 50) * 100)),
    },
    newJoiners: {
      value: joinersCurrent,
      delta: getDelta(joinersCurrent, joinersPrev),
      progress: Math.min(100, joinersCurrent * 20),
    },
    exitedEmployees: {
      value: exitedCurrent,
      delta: getDelta(exitedCurrent, exitedPrev),
      progress: Math.min(100, exitedCurrent * 25),
    },
    employeesOnPip: {
      value: pipCurrent,
      delta: getDelta(pipCurrent, pipPrev),
      progress: Math.min(100, pipCurrent * 33),
    },
  };
};

/**
 * 3. Employee Strength (headcount progression over the last 12 months)
 */
export const getStrengthTrends = async ({ teamEmployeeIds, months = 12 }) => {
  const filter = buildEmployeeFilter({ teamEmployeeIds });
  const employees = await Employee.find(filter, 'employment.dateOfJoining employment.dateOfLeaving status');

  const now = new Date();
  const series = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // End of target month
    const monthLabel = d.toLocaleString('en-US', { month: 'short' });
    const yearLabel = d.getFullYear();

    const count = employees.filter((e) => {
      const join = e.employment?.dateOfJoining ? new Date(e.employment.dateOfJoining) : null;
      const leave = e.employment?.dateOfLeaving ? new Date(e.employment.dateOfLeaving) : null;
      if (!join) return false;
      return join <= d && (!leave || leave > d);
    }).length;

    series.push({
      month: monthLabel,
      year: yearLabel,
      headcount: count,
      date: d.toISOString(),
    });
  }

  const counts = series.map((s) => s.headcount);
  const highest = counts.length > 0 ? Math.max(...counts) : 0;
  const lowest = counts.length > 0 ? Math.min(...counts) : 0;
  const current = series.length > 0 ? series[series.length - 1].headcount : 0;

  return {
    series,
    summary: { highest, lowest, current },
  };
};

/**
 * 4. Net Growth (Monthly Joiners minus Leavers)
 */
export const getNetGrowth = async ({ teamEmployeeIds, months = 12 }) => {
  const filter = buildEmployeeFilter({ teamEmployeeIds });
  const employees = await Employee.find(filter, 'employment.dateOfJoining employment.dateOfLeaving');

  const now = new Date();
  const series = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const monthLabel = start.toLocaleString('en-US', { month: 'short' });

    let joiners = 0;
    let leavers = 0;

    for (const e of employees) {
      if (e.employment?.dateOfJoining) {
        const j = new Date(e.employment.dateOfJoining);
        if (j >= start && j <= end) joiners++;
      }
      if (e.employment?.dateOfLeaving) {
        const l = new Date(e.employment.dateOfLeaving);
        if (l >= start && l <= end) leavers++;
      }
    }

    const net = joiners - leavers;
    series.push({
      month: monthLabel,
      joiners,
      leavers,
      net,
      badge: net >= 0 ? `+${net}` : `${net}`,
    });
  }

  return { series };
};

/**
 * 5. Employee Distribution (Group by x Cross by)
 */
export const getEmployeeDistribution = async ({
  teamEmployeeIds,
  groupBy = 'department',
  crossBy = 'gender',
  department,
  employeeType,
}) => {
  const filter = buildEmployeeFilter({ teamEmployeeIds, department, employeeType });
  const employees = await Employee.find(filter)
    .populate('employment.department', 'name code')
    .select('personal employment status');

  const groupMap = new Map();
  const allCrossCategories = new Set();

  for (const emp of employees) {
    // 1. Resolve Group key
    let gKey = 'Other';
    if (groupBy === 'department') {
      gKey = emp.employment?.department?.name || 'Unassigned';
    } else if (groupBy === 'designation') {
      gKey = emp.employment?.designation || 'Other';
    } else if (groupBy === 'employeeType') {
      gKey = emp.employment?.employeeType || 'Full-Time';
    } else if (groupBy === 'location' || groupBy === 'workMode') {
      gKey = emp.employment?.workMode || 'On-site';
    }

    // 2. Resolve Cross key
    let cKey = 'Other';
    if (crossBy === 'gender') {
      cKey = emp.personal?.gender || 'Other';
    } else if (crossBy === 'employeeType') {
      cKey = emp.employment?.employeeType || 'Full-Time';
    } else if (crossBy === 'ageBand') {
      if (emp.personal?.dob) {
        const age = new Date().getFullYear() - new Date(emp.personal.dob).getFullYear();
        if (age < 25) cKey = '< 25 yrs';
        else if (age <= 34) cKey = '25 - 34 yrs';
        else if (age <= 44) cKey = '35 - 44 yrs';
        else cKey = '45+ yrs';
      } else {
        cKey = 'Unknown';
      }
    }

    allCrossCategories.add(cKey);

    if (!groupMap.has(gKey)) {
      groupMap.set(gKey, { group: gKey, total: 0 });
    }
    const row = groupMap.get(gKey);
    row[cKey] = (row[cKey] || 0) + 1;
    row.total = (row.total || 0) + 1;
  }

  const data = Array.from(groupMap.values()).sort((a, b) => b.total - a.total);
  const categories = Array.from(allCrossCategories);

  return { data, categories, groupBy, crossBy };
};

/**
 * 6. Leave Types Summary (Donut Chart)
 */
export const getLeaveTypesSummary = async ({ teamEmployeeIds, from, to, department }) => {
  const empFilter = buildEmployeeFilter({ teamEmployeeIds, department });
  const allowedEmpIds = (await Employee.find(empFilter, '_id')).map((e) => e._id);

  const query = {
    employee: { $in: allowedEmpIds },
    status: 'approved',
  };

  if (from || to) {
    query.fromDate = {};
    if (from) query.fromDate.$gte = new Date(from);
    if (to) query.fromDate.$lte = new Date(to);
  }

  const leaves = await LeaveRequest.find(query).populate('leaveType', 'name code');

  const leaveColorPalette = ['#6366F1', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
  const typeMap = new Map();
  let totalDays = 0;

  for (const l of leaves) {
    const typeName = l.leaveType?.name || 'General Leave';
    const days = Number(l.days) || 1;
    totalDays += days;
    typeMap.set(typeName, (typeMap.get(typeName) || 0) + days);
  }

  const data = [];
  let colorIdx = 0;
  for (const [name, value] of typeMap.entries()) {
    data.push({
      name,
      value,
      percentage: totalDays > 0 ? Math.round((value / totalDays) * 100) : 0,
      color: leaveColorPalette[colorIdx % leaveColorPalette.length],
    });
    colorIdx++;
  }

  return { data, totalDays };
};

/**
 * 7. Late Reasons Breakdown
 */
export const getLateReasonsSummary = async ({ teamEmployeeIds, from, to, department }) => {
  const empFilter = buildEmployeeFilter({ teamEmployeeIds, department });
  const allowedEmpIds = (await Employee.find(empFilter, '_id')).map((e) => e._id);

  const query = {
    employee: { $in: allowedEmpIds },
    $or: [{ status: 'late' }, { lateMinutes: { $gt: 0 } }],
  };

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const records = await Attendance.find(query, 'lateReason lateMinutes');
  const reasonMap = new Map([
    ['Transport issue', 0],
    ['Personal commitment', 0],
    ['Health', 0],
    ['Weather', 0],
    ['Other', 0],
  ]);

  let totalLateCount = 0;
  for (const r of records) {
    const reason = r.lateReason || 'Other';
    totalLateCount++;
    reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
  }

  const data = Array.from(reasonMap.entries()).map(([reason, count]) => ({
    reason,
    count,
    percentage: totalLateCount > 0 ? Math.round((count / totalLateCount) * 100) : 0,
  }));

  return { data, totalLateCount };
};

/**
 * 8. Employee Growth (Monthly New Joiners vs Exited)
 */
export const getEmployeeGrowth = async ({ teamEmployeeIds, months = 12 }) => {
  const filter = buildEmployeeFilter({ teamEmployeeIds });
  const employees = await Employee.find(filter, 'employment.dateOfJoining employment.dateOfLeaving');

  const now = new Date();
  const series = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const month = start.toLocaleString('en-US', { month: 'short' });

    let joiners = 0;
    let leavers = 0;

    for (const e of employees) {
      if (e.employment?.dateOfJoining) {
        const j = new Date(e.employment.dateOfJoining);
        if (j >= start && j <= end) joiners++;
      }
      if (e.employment?.dateOfLeaving) {
        const l = new Date(e.employment.dateOfLeaving);
        if (l >= start && l <= end) leavers++;
      }
    }

    series.push({ month, joiners, leavers });
  }

  return { series };
};

/**
 * 9. Late Attendance Analytics (KPIs + Ranked List)
 */
export const getLateAttendanceAnalytics = async ({ teamEmployeeIds, from, to, department }) => {
  const empFilter = buildEmployeeFilter({ teamEmployeeIds, department });
  const allowedEmpIds = (await Employee.find(empFilter, '_id')).map((e) => e._id);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const query = {
    employee: { $in: allowedEmpIds },
    $or: [{ status: 'late' }, { lateMinutes: { $gt: 0 } }],
  };

  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const records = await Attendance.find(query).populate({
    path: 'employee',
    select: 'employeeId personal.firstName personal.lastName personal.photo employment.department',
    populate: { path: 'employment.department', select: 'name code' },
  });

  let lateToday = 0;
  let totalLateMinutes = 0;
  const employeeStats = new Map();

  for (const r of records) {
    const mins = r.lateMinutes || 15;
    totalLateMinutes += mins;

    if (new Date(r.date) >= todayStart) {
      lateToday++;
    }

    if (r.employee) {
      const id = r.employee._id.toString();
      if (!employeeStats.has(id)) {
        employeeStats.set(id, {
          employee: r.employee,
          lateCount: 0,
          totalMinutes: 0,
        });
      }
      const item = employeeStats.get(id);
      item.lateCount += 1;
      item.totalMinutes += mins;
    }
  }

  const uniqueLateEmployees = employeeStats.size;
  const avgLateMinutes = records.length > 0 ? Math.round(totalLateMinutes / records.length) : 0;

  // Format totalLateTime in hours & minutes
  const hours = Math.floor(totalLateMinutes / 60);
  const remainingMins = totalLateMinutes % 60;
  const totalLateFormatted = `${hours}h ${remainingMins}m`;

  // Top ranked employees by late arrivals
  const ranked = Array.from(employeeStats.values())
    .sort((a, b) => b.lateCount - a.lateCount)
    .slice(0, 5)
    .map((item) => ({
      id: item.employee._id,
      name: `${item.employee.personal?.firstName || ''} ${item.employee.personal?.lastName || ''}`.trim(),
      employeeId: item.employee.employeeId,
      photo: item.employee.personal?.photo?.url || '',
      department: item.employee.employment?.department?.name || 'General',
      lateCount: item.lateCount,
      totalMinutes: item.totalMinutes,
    }));

  return {
    kpis: {
      lateToday,
      totalLateEmployees: uniqueLateEmployees,
      averageLateMinutes: avgLateMinutes,
      totalLateTime: totalLateFormatted,
    },
    ranked,
  };
};

/**
 * 10. Late Arrival Today
 */
export const getLateTodayList = async ({ teamEmployeeIds, department }) => {
  const empFilter = buildEmployeeFilter({ teamEmployeeIds, department });
  const allowedEmpIds = (await Employee.find(empFilter, '_id')).map((e) => e._id);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const records = await Attendance.find({
    employee: { $in: allowedEmpIds },
    date: { $gte: todayStart, $lte: todayEnd },
    $or: [{ status: 'late' }, { lateMinutes: { $gt: 0 } }],
  }).populate({
    path: 'employee',
    select: 'employeeId personal.firstName personal.lastName personal.photo employment.department',
    populate: { path: 'employment.department', select: 'name code' },
  });

  return records.map((r) => ({
    id: r.employee?._id,
    employeeId: r.employee?.employeeId,
    name: `${r.employee?.personal?.firstName || ''} ${r.employee?.personal?.lastName || ''}`.trim(),
    photo: r.employee?.personal?.photo?.url || '',
    department: r.employee?.employment?.department?.name || 'General',
    checkInTime: r.checkIn,
    lateMinutes: r.lateMinutes || 15,
    lateReason: r.lateReason || 'Transport issue',
  }));
};

/**
 * 11. No Leave Employee Spotlight
 */
export const getNoLeaveEmployees = async ({ teamEmployeeIds, month, year, department }) => {
  const empFilter = buildEmployeeFilter({ teamEmployeeIds, department });
  empFilter.status = { $in: ['active', 'probation'] };

  const employees = await Employee.find(empFilter)
    .populate('employment.department', 'name code')
    .select('employeeId personal employment');

  const now = new Date();
  const targetYear = year ? parseInt(year, 10) : now.getFullYear();
  const targetMonth = month ? parseInt(month, 10) : now.getMonth();

  const startOfMonth = new Date(targetYear, targetMonth, 1);
  const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

  // Employees who took approved leave in this month
  const leavesInMonth = await LeaveRequest.find({
    status: 'approved',
    fromDate: { $lte: endOfMonth },
    toDate: { $gte: startOfMonth },
  }).select('employee');

  const leaveTakers = new Set(leavesInMonth.map((l) => l.employee.toString()));

  const noLeaveList = employees
    .filter((emp) => !leaveTakers.has(emp._id.toString()))
    .map((emp) => ({
      id: emp._id,
      employeeId: emp.employeeId,
      name: `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim(),
      photo: emp.personal?.photo?.url || '',
      designation: emp.employment?.designation || 'Staff',
      department: emp.employment?.department?.name || 'General',
      location: emp.employment?.workMode || 'Bhubaneswar HQ',
    }));

  return {
    month: startOfMonth.toLocaleString('en-US', { month: 'long' }),
    year: targetYear,
    count: noLeaveList.length,
    employees: noLeaveList,
  };
};

/**
 * 12. Average Mood Summary
 */
export const getMoodSummary = async ({ teamEmployeeIds, from, to, isHRAdmin }) => {
  const query = {};
  if (teamEmployeeIds && teamEmployeeIds.length > 0) {
    query.employee = { $in: teamEmployeeIds };
  }
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }

  const checkins = await MoodCheckin.find(query).populate({
    path: 'employee',
    select: 'employeeId personal.firstName personal.lastName personal.photo employment.department',
    populate: { path: 'employment.department', select: 'name code' },
  });

  const moods = ['Happy', 'Good', 'Cool', 'Confused', 'Sad', 'Afraid', 'Angry', 'Frustrated'];
  const moodCounts = Object.fromEntries(moods.map((m) => [m, 0]));

  for (const c of checkins) {
    if (moodCounts[c.mood] !== undefined) {
      moodCounts[c.mood]++;
    }
  }

  const total = checkins.length;
  const distribution = moods.map((mood) => ({
    mood,
    count: moodCounts[mood],
    percentage: total > 0 ? Math.round((moodCounts[mood] / total) * 100) : 0,
  }));

  let negativeAlerts = [];
  if (isHRAdmin) {
    const negativeMoods = new Set(['Confused', 'Sad', 'Afraid', 'Angry', 'Frustrated']);
    const employeeNegativeCounts = new Map();

    for (const c of checkins) {
      if (negativeMoods.has(c.mood) && c.employee) {
        const id = c.employee._id.toString();
        if (!employeeNegativeCounts.has(id)) {
          employeeNegativeCounts.set(id, {
            employee: c.employee,
            count: 0,
            recentMoods: [],
          });
        }
        const item = employeeNegativeCounts.get(id);
        item.count++;
        item.recentMoods.push({ mood: c.mood, date: c.date, note: c.note });
      }
    }

    negativeAlerts = Array.from(employeeNegativeCounts.values())
      .filter((i) => i.count >= 2)
      .map((i) => ({
        id: i.employee._id,
        employeeId: i.employee.employeeId,
        name: `${i.employee.personal?.firstName || ''} ${i.employee.personal?.lastName || ''}`.trim(),
        department: i.employee.employment?.department?.name || 'General',
        negativeCount: i.count,
        recentMoods: i.recentMoods.slice(-3),
      }));
  }

  return {
    totalCheckins: total,
    distribution,
    negativeAlerts,
  };
};
