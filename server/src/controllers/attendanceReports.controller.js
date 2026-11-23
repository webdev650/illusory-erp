import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { AttendanceLog } from '../models/AttendanceLog.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { CompOffCredit } from '../models/CompOffCredit.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { LeavePolicyYear } from '../models/LeavePolicyYear.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { toISTDateString } from '../services/dayStatus.service.js';

/**
 * Helper: Resolve manager employee scope
 */
const resolveEmployeeScope = async (req) => {
  const userRole = req.userRole;
  const permissions = req.permissions || [];

  const isFullAccess =
    ['super_admin', 'admin', 'hr'].includes(userRole) ||
    permissions.includes('*') ||
    permissions.includes('attendance.manage') ||
    permissions.includes('reports.view');

  if (isFullAccess) return {}; // All employees allowed

  if (userRole === 'manager') {
    const currentEmp = await Employee.findOne({
      $or: [{ _id: req.user.employee }, { 'personal.officialEmail': req.user.email }],
    });
    if (!currentEmp) return { _id: new mongoose.Types.ObjectId() }; // Empty set
    return {
      $or: [
        { _id: currentEmp._id },
        { 'employment.reportingManager': currentEmp._id },
      ],
    };
  }

  // Regular employees blocked from executive reports
  return null;
};

/**
 * 1. Monthly Attendance Register
 */
export const getMonthlyRegisterReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied. Reports are restricted to managers and HR.', 403);

    const { year = 2026, month = 11, department, format } = req.query;
    const yearNum = Number(year);
    const monthNum = Number(month);

    const startStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    const endStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const filter = { isDeleted: false, ...scope };
    if (department && department !== 'all') filter['employment.department'] = department;

    const employees = await Employee.find(filter)
      .populate('employment.department', 'name')
      .select('personal.firstName personal.lastName employeeId employment.department')
      .sort({ 'personal.firstName': 1 });

    const empIds = employees.map((e) => e._id);

    const attendances = await Attendance.find({
      employee: { $in: empIds },
      date: { $gte: startStr, $lte: endStr },
    });

    const dates = [];
    for (let d = 1; d <= lastDay; d++) {
      dates.push(`${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }

    const rows = employees.map((emp) => {
      const empAtt = attendances.filter((a) => String(a.employee) === String(emp._id));
      const dayMap = {};
      let presentCount = 0;
      let leaveCount = 0;
      let weekOffCount = 0;
      let holidayCount = 0;
      let notPaCount = 0;

      dates.forEach((dStr) => {
        const att = empAtt.find((a) => a.date === dStr);
        const status = att?.status || 'NOT_PA';
        dayMap[dStr] = status;

        if (['LOG_OK', 'BREAK_LOG', 'CHANGED_LOG', 'REMOTE_WORK', 'PARTIAL_DAY'].includes(status)) {
          presentCount++;
        } else if (status === 'LEAVE') {
          leaveCount++;
        } else if (status === 'WEEK_OFF') {
          weekOffCount++;
        } else if (status === 'HOLIDAY') {
          holidayCount++;
        } else if (status === 'NOT_PA') {
          notPaCount++;
        }
      });

      return {
        employeeId: emp._id,
        employeeCode: emp.employeeId,
        name: `${emp.personal?.firstName} ${emp.personal?.lastName}`.trim(),
        department: emp.employment?.department?.name || 'General',
        days: dayMap,
        summary: {
          present: presentCount,
          leave: leaveCount,
          weekOff: weekOffCount,
          holiday: holidayCount,
          notPa: notPaCount,
          total: dates.length,
        },
      };
    });

    if (format === 'csv') {
      const headers = ['Employee Code', 'Employee Name', 'Department', ...dates, 'Present', 'Leave', 'Week Off', 'Holiday', 'Absent (NOT P/A)'];
      const csvRows = rows.map((r) => [
        r.employeeCode,
        `"${r.name}"`,
        `"${r.department}"`,
        ...dates.map((d) => r.days[d]),
        r.summary.present,
        r.summary.leave,
        r.summary.weekOff,
        r.summary.holiday,
        r.summary.notPa,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=monthly-register-${yearNum}-${monthNum}.csv`);
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, { year: yearNum, month: monthNum, dates, rows }, 'Monthly attendance register retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Late Arrivals Report
 */
export const getLateArrivalsReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { startDate, endDate, format } = req.query;
    const startStr = startDate || '2026-11-01';
    const endStr = endDate || '2026-11-30';

    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id personal.firstName personal.lastName employeeId employment.department');
    const empIds = employees.map((e) => e._id);

    const attendances = await Attendance.find({
      employee: { $in: empIds },
      date: { $gte: startStr, $lte: endStr },
      lateMinutes: { $gt: 0 },
    }).populate('employee', 'personal.firstName personal.lastName employeeId employment.department')
      .populate('shift', 'name startTime')
      .sort({ date: -1, lateMinutes: -1 });

    const rows = attendances.map((a) => ({
      date: a.date,
      employeeCode: a.employee?.employeeId,
      employeeName: `${a.employee?.personal?.firstName} ${a.employee?.personal?.lastName}`,
      shiftName: a.shift?.name || 'General Shift',
      shiftStartTime: a.shift?.startTime || '10:00',
      firstIn: a.firstIn ? new Date(a.firstIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
      lateMinutes: a.lateMinutes,
      status: a.status,
    }));

    if (format === 'csv') {
      const headers = ['Date', 'Employee Code', 'Employee Name', 'Shift', 'Shift Start', 'First In', 'Late (mins)', 'Status'];
      const csvRows = rows.map((r) => [
        r.date,
        r.employeeCode,
        `"${r.employeeName}"`,
        `"${r.shiftName}"`,
        r.shiftStartTime,
        r.firstIn,
        r.lateMinutes,
        r.status,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=late-arrivals-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Late arrivals report retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Leave Balance Report
 */
export const getLeaveBalanceReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { year = 2026, format } = req.query;
    const yearNum = Number(year);

    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id personal.firstName personal.lastName employeeId employment.department');
    const empIds = employees.map((e) => e._id);

    const balances = await LeaveBalance.find({
      employee: { $in: empIds },
      year: yearNum,
    }).populate('employee', 'personal.firstName personal.lastName employeeId employment.department')
      .populate('leaveType', 'name code')
      .sort({ 'employee.employeeId': 1 });

    const rows = balances.map((b) => ({
      employeeCode: b.employee?.employeeId,
      employeeName: `${b.employee?.personal?.firstName} ${b.employee?.personal?.lastName}`,
      leaveType: b.leaveType?.name,
      openingDays: parseFloat((b.openingMinutes / 465).toFixed(2)),
      entitlementDays: parseFloat((b.entitlementMinutes / 465).toFixed(2)),
      carriedInDays: parseFloat((b.carriedInMinutes / 465).toFixed(2)),
      takenDays: parseFloat((b.takenMinutes / 465).toFixed(2)),
      pendingDays: parseFloat((b.pendingMinutes / 465).toFixed(2)),
      closingDays: parseFloat((b.closingMinutes / 465).toFixed(2)),
      carriedForwardDays: parseFloat((b.carriedForwardMinutes / 465).toFixed(2)),
      encashedDays: parseFloat((b.encashedMinutes / 465).toFixed(2)),
      lapsedDays: parseFloat((b.lapsedMinutes / 465).toFixed(2)),
    }));

    if (format === 'csv') {
      const headers = ['Employee Code', 'Employee Name', 'Leave Type', 'Opening', 'Entitlement', 'Carried In', 'Taken', 'Pending', 'Closing', 'Carried Forward', 'Encashed', 'Lapsed'];
      const csvRows = rows.map((r) => [
        r.employeeCode,
        `"${r.employeeName}"`,
        `"${r.leaveType}"`,
        r.openingDays,
        r.entitlementDays,
        r.carriedInDays,
        r.takenDays,
        r.pendingDays,
        r.closingDays,
        r.carriedForwardDays,
        r.encashedDays,
        r.lapsedDays,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leave-balance-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Leave balance report retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Regularization Report
 */
export const getRegularizationReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { status, format } = req.query;
    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id');
    const empIds = employees.map((e) => e._id);

    const query = { employee: { $in: empIds } };
    if (status && status !== 'all') query.status = status;

    const list = await AttendanceRegularization.find(query)
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .sort({ date: -1 });

    const rows = list.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      employeeCode: r.employee?.employeeId,
      employeeName: `${r.employee?.personal?.firstName} ${r.employee?.personal?.lastName}`,
      punchType: r.punchType,
      requestedTime: r.requestedTime ? new Date(r.requestedTime).toLocaleTimeString('en-IN') : '-',
      reason: r.reason,
      status: r.status,
    }));

    if (format === 'csv') {
      const headers = ['Date', 'Employee Code', 'Employee Name', 'Punch Type', 'Requested Time', 'Reason', 'Status'];
      const csvRows = rows.map((r) => [
        r.date,
        r.employeeCode,
        `"${r.employeeName}"`,
        r.punchType,
        r.requestedTime,
        `"${r.reason}"`,
        r.status,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=regularization-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Regularization report retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 5. Remote Work Report
 */
export const getRemoteWorkReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { status, format } = req.query;
    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id');
    const empIds = employees.map((e) => e._id);

    const query = { employee: { $in: empIds } };
    if (status && status !== 'all') query.status = status;

    const list = await RemoteWorkRequest.find(query)
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .sort({ fromDate: -1 });

    const rows = list.map((r) => ({
      fromDate: r.fromDate.toISOString().split('T')[0],
      toDate: r.toDate.toISOString().split('T')[0],
      days: r.days,
      employeeCode: r.employee?.employeeId,
      employeeName: `${r.employee?.personal?.firstName} ${r.employee?.personal?.lastName}`,
      reason: r.reason,
      status: r.status,
    }));

    if (format === 'csv') {
      const headers = ['From Date', 'To Date', 'Days', 'Employee Code', 'Employee Name', 'Reason', 'Status'];
      const csvRows = rows.map((r) => [
        r.fromDate,
        r.toDate,
        r.days,
        r.employeeCode,
        `"${r.employeeName}"`,
        `"${r.reason}"`,
        r.status,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=remote-work-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Remote work report retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 6. Overtime Report
 */
export const getOvertimeReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { startDate, endDate, format } = req.query;
    const startStr = startDate || '2026-11-01';
    const endStr = endDate || '2026-11-30';

    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id');
    const empIds = employees.map((e) => e._id);

    const list = await Attendance.find({
      employee: { $in: empIds },
      date: { $gte: startStr, $lte: endStr },
      overtimeMinutes: { $gt: 0 },
    }).populate('employee', 'personal.firstName personal.lastName employeeId')
      .sort({ date: -1, overtimeMinutes: -1 });

    const rows = list.map((a) => ({
      date: a.date,
      employeeCode: a.employee?.employeeId,
      employeeName: `${a.employee?.personal?.firstName} ${a.employee?.personal?.lastName}`,
      workedMinutes: a.workedMinutes,
      workedHours: parseFloat((a.workedMinutes / 60).toFixed(2)),
      overtimeMinutes: a.overtimeMinutes,
      overtimeHours: parseFloat((a.overtimeMinutes / 60).toFixed(2)),
      status: a.status,
    }));

    if (format === 'csv') {
      const headers = ['Date', 'Employee Code', 'Employee Name', 'Worked (Hrs)', 'Overtime (Hrs)', 'Status'];
      const csvRows = rows.map((r) => [
        r.date,
        r.employeeCode,
        `"${r.employeeName}"`,
        r.workedHours,
        r.overtimeHours,
        r.status,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=overtime-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Overtime report retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 7. Comp-Off Credits & Expiry Report
 */
export const getCompOffCreditsReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { status, format } = req.query;
    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id');
    const empIds = employees.map((e) => e._id);

    const query = { employee: { $in: empIds } };
    if (status && status !== 'all') query.status = status;

    const list = await CompOffCredit.find(query)
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .sort({ workedDate: -1 });

    const rows = list.map((c) => ({
      workedDate: c.workedDate.toISOString().split('T')[0],
      employeeCode: c.employee?.employeeId,
      employeeName: `${c.employee?.personal?.firstName} ${c.employee?.personal?.lastName}`,
      creditDays: c.creditDays,
      usedDays: c.usedDays,
      balanceDays: parseFloat((c.creditDays - c.usedDays).toFixed(2)),
      expiresAt: c.expiresAt ? c.expiresAt.toISOString().split('T')[0] : '-',
      status: c.status,
    }));

    if (format === 'csv') {
      const headers = ['Worked Date', 'Employee Code', 'Employee Name', 'Credit Days', 'Used Days', 'Balance Days', 'Expiry Date', 'Status'];
      const csvRows = rows.map((r) => [
        r.workedDate,
        r.employeeCode,
        `"${r.employeeName}"`,
        r.creditDays,
        r.usedDays,
        r.balanceDays,
        r.expiresAt,
        r.status,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=comp-off-credits-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Comp-off credits report retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 8. Absentee (NOT P/A) Report
 */
export const getAbsenteeReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { startDate, endDate, format } = req.query;
    const startStr = startDate || '2026-11-01';
    const endStr = endDate || '2026-11-30';

    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id');
    const empIds = employees.map((e) => e._id);

    const list = await Attendance.find({
      employee: { $in: empIds },
      date: { $gte: startStr, $lte: endStr },
      status: 'NOT_PA',
    }).populate('employee', 'personal.firstName personal.lastName employeeId')
      .sort({ date: -1 });

    const rows = list.map((a) => ({
      date: a.date,
      employeeCode: a.employee?.employeeId,
      employeeName: `${a.employee?.personal?.firstName} ${a.employee?.personal?.lastName}`,
      status: 'NOT P/A',
      reason: 'No attendance punch or approved leave recorded on working day',
    }));

    if (format === 'csv') {
      const headers = ['Date', 'Employee Code', 'Employee Name', 'Status', 'Diagnosis'];
      const csvRows = rows.map((r) => [
        r.date,
        r.employeeCode,
        `"${r.employeeName}"`,
        r.status,
        `"${r.reason}"`,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=absentee-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Absentee report retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 9. Missing Punches Report
 */
export const getMissingPunchesReport = async (req, res, next) => {
  try {
    const scope = await resolveEmployeeScope(req);
    if (scope === null) return sendError(res, 'Access denied', 403);

    const { startDate, endDate, format } = req.query;
    const startStr = startDate || '2026-11-01';
    const endStr = endDate || '2026-11-30';

    const filter = { isDeleted: false, ...scope };
    const employees = await Employee.find(filter).select('_id');
    const empIds = employees.map((e) => e._id);

    const list = await Attendance.find({
      employee: { $in: empIds },
      date: { $gte: startStr, $lte: endStr },
      hasMissingClockOut: true,
    }).populate('employee', 'personal.firstName personal.lastName employeeId')
      .sort({ date: -1 });

    const rows = list.map((a) => ({
      date: a.date,
      employeeCode: a.employee?.employeeId,
      employeeName: `${a.employee?.personal?.firstName} ${a.employee?.personal?.lastName}`,
      firstIn: a.firstIn ? new Date(a.firstIn).toLocaleTimeString('en-IN') : '-',
      anomaly: 'Missing Clock-out punch',
      status: a.status,
    }));

    if (format === 'csv') {
      const headers = ['Date', 'Employee Code', 'Employee Name', 'First In', 'Anomaly', 'Status'];
      const csvRows = rows.map((r) => [
        r.date,
        r.employeeCode,
        `"${r.employeeName}"`,
        r.firstIn,
        r.anomaly,
        r.status,
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=missing-punches-report.csv');
      return res.status(200).send([headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n'));
    }

    return sendSuccess(res, rows, 'Missing punches report retrieved');
  } catch (err) {
    next(err);
  }
};
