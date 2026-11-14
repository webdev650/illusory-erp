import { Attendance } from '../models/Attendance.js';
import { Shift } from '../models/Shift.js';
import { Employee } from '../models/Employee.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { normalizeToKolkataMidnight, isPunchLate } from '../utils/dateUtils.js';
import { createApprovalRequest } from '../services/approval.service.js';
import { logAudit } from '../middleware/audit.js';

// POST /api/v1/hr/attendance/check-in
export const checkIn = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) {
      return sendError(res, 'No linked employee record found for your account', 400);
    }

    const todayMidnight = normalizeToKolkataMidnight(new Date());

    // Check if attendance record already exists for today
    let record = await Attendance.findOne({
      employee: employeeId,
      date: todayMidnight,
    });

    if (record && record.checkIn) {
      return sendError(res, 'You have already checked in for today', 400);
    }

    const shift = (await Shift.findOne({ isDefault: true })) || {
      startTime: '09:30',
      graceMinutes: 15,
    };

    const serverNow = new Date(); // Truth is server clock
    const isLate = isPunchLate(serverNow, shift.startTime, shift.graceMinutes);
    const initialStatus = isLate ? 'late' : 'present';

    if (!record) {
      record = await Attendance.create({
        employee: employeeId,
        date: todayMidnight,
        checkIn: serverNow,
        status: initialStatus,
        source: 'web',
        location: req.body.location || 'Studio (Bhubaneswar)',
      });
    } else {
      record.checkIn = serverNow;
      record.status = initialStatus;
      await record.save();
    }

    return sendSuccess(
      res,
      record,
      `Checked in successfully at ${serverNow.toLocaleTimeString()} (${isLate ? 'Late arrival recorded' : 'On-time'})`
    );
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/hr/attendance/check-out
export const checkOut = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) {
      return sendError(res, 'No linked employee record found', 400);
    }

    const todayMidnight = normalizeToKolkataMidnight(new Date());
    const record = await Attendance.findOne({
      employee: employeeId,
      date: todayMidnight,
    });

    if (!record || !record.checkIn) {
      return sendError(res, 'No check-in record found for today. Please check in first.', 400);
    }

    const serverNow = new Date();
    record.checkOut = serverNow;

    // Auto-close any unclosed break
    let totalBreakMs = 0;
    if (record.breaks && record.breaks.length > 0) {
      record.breaks.forEach((b) => {
        if (!b.end) b.end = serverNow;
        totalBreakMs += Math.max(0, new Date(b.end) - new Date(b.start));
      });
    }

    const rawDiffMs = serverNow - new Date(record.checkIn);
    const netDiffMs = Math.max(0, rawDiffMs - totalBreakMs);
    const workHours = parseFloat((netDiffMs / (1000 * 60 * 60)).toFixed(2));
    record.workHours = workHours;

    const shift = (await Shift.findOne({ isDefault: true })) || {
      halfDayHours: 4,
    };

    // If worked less than half-day hours and wasn't marked leave, mark half_day
    if (workHours < shift.halfDayHours && record.status !== 'leave') {
      record.status = 'half_day';
      record.note = (record.note ? record.note + ' | ' : '') + 'Early departure (< 4 hrs)';
    }

    await record.save();

    return sendSuccess(
      res,
      record,
      `Checked out successfully at ${serverNow.toLocaleTimeString()} (Logged ${workHours} hrs, Breaks: ${Math.round(totalBreakMs / 60000)}m)`
    );
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/hr/attendance/break-in
export const breakIn = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) {
      return sendError(res, 'No linked employee record found', 400);
    }

    const todayMidnight = normalizeToKolkataMidnight(new Date());
    const record = await Attendance.findOne({
      employee: employeeId,
      date: todayMidnight,
    });

    if (!record || !record.checkIn) {
      return sendError(res, 'Please clock in first before taking a break', 400);
    }
    if (record.checkOut) {
      return sendError(res, 'You have already clocked out for today', 400);
    }

    const openBreak = record.breaks?.find((b) => !b.end);
    if (openBreak) {
      return sendError(res, 'You are already on a break', 400);
    }

    const serverNow = new Date();
    if (!record.breaks) record.breaks = [];
    record.breaks.push({
      start: serverNow,
      reason: req.body.reason || 'Break',
    });
    await record.save();

    return sendSuccess(
      res,
      record,
      `Break started at ${serverNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/hr/attendance/break-out
export const breakOut = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) {
      return sendError(res, 'No linked employee record found', 400);
    }

    const todayMidnight = normalizeToKolkataMidnight(new Date());
    const record = await Attendance.findOne({
      employee: employeeId,
      date: todayMidnight,
    });

    if (!record || !record.checkIn) {
      return sendError(res, 'No clock in record found for today', 400);
    }

    const openBreak = record.breaks?.find((b) => !b.end);
    if (!openBreak) {
      return sendError(res, 'You are not currently on a break', 400);
    }

    const serverNow = new Date();
    openBreak.end = serverNow;
    await record.save();

    return sendSuccess(
      res,
      record,
      `Resumed from break at ${serverNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/attendance/today
export const getTodayStatus = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) {
      return sendSuccess(res, null, 'No linked employee');
    }

    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const queryMidnight = normalizeToKolkataMidnight(targetDate);
    const record = await Attendance.findOne({
      employee: employeeId,
      date: queryMidnight,
    });

    const shift = (await Shift.findOne({ isDefault: true })) || {
      startTime: '09:30',
      endTime: '18:30',
      graceMinutes: 15,
    };

    return sendSuccess(res, {
      record,
      shift,
      serverTime: new Date(),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/attendance/my-monthly
export const getMyMonthlyAttendance = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) return sendSuccess(res, { records: [], summary: {} });

    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month, 10) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year, 10) : now.getFullYear();

    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const records = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    const summary = {
      present: records.filter((r) => r.status === 'present').length,
      late: records.filter((r) => r.status === 'late').length,
      halfDay: records.filter((r) => r.status === 'half_day').length,
      leave: records.filter((r) => r.status === 'leave').length,
      absent: records.filter((r) => r.status === 'absent').length,
      totalHours: records.reduce((sum, r) => sum + (r.workHours || 0), 0).toFixed(1),
    };

    return sendSuccess(res, { records, summary, month: targetMonth + 1, year: targetYear });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/attendance/team (Manager direct reports view)
export const getTeamAttendance = async (req, res, next) => {
  try {
    const managerId = req.user.employee?._id;
    if (!managerId) return sendSuccess(res, []);

    const directReports = await Employee.find({
      'employment.reportingManager': managerId,
      isDeleted: false,
    }).select('_id personal.firstName personal.lastName employeeId employment.designation');

    const reportIds = directReports.map((e) => e._id);
    const today = normalizeToKolkataMidnight(new Date());

    const attendanceRecords = await Attendance.find({
      employee: { $in: reportIds },
      date: today,
    }).populate('employee', 'personal.firstName personal.lastName employeeId employment.designation');

    return sendSuccess(res, { directReports, attendanceRecords });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/attendance/all (HR / Admin view with filters & CSV export)
export const getAllAttendance = async (req, res, next) => {
  try {
    const { startDate, endDate, department, employeeId, status, format, page = 1, limit = 20 } = req.query;

    const query = {};

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      const today = normalizeToKolkataMidnight(new Date());
      query.date = today;
    }

    if (status) query.status = status;
    if (employeeId) query.employee = employeeId;

    if (department) {
      const deptEmployees = await Employee.find({
        'employment.department': department,
        isDeleted: false,
      }).select('_id');
      query.employee = { $in: deptEmployees.map((e) => e._id) };
    }

    // CSV Export option
    if (format === 'csv') {
      const records = await Attendance.find(query)
        .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
        .sort({ date: -1 });

      let csv = 'Employee ID,Name,Designation,Date,Check In,Check Out,Work Hours,Status,Note\n';
      for (const r of records) {
        const emp = r.employee || {};
        const p = emp.personal || {};
        const inStr = r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : 'N/A';
        const outStr = r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : 'N/A';
        csv += `"${emp.employeeId || ''}","${p.firstName || ''} ${p.lastName || ''}","${emp.employment?.designation || ''}","${new Date(r.date).toLocaleDateString()}","${inStr}","${outStr}",${r.workHours || 0},"${r.status}","${r.note || ''}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_export_${Date.now()}.csv`);
      return res.status(200).send(csv);
    }

    // Paginated JSON
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate({
          path: 'employee',
          select: 'personal.firstName personal.lastName employeeId employment.designation employment.department',
          populate: { path: 'employment.department', select: 'name code' },
        })
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Attendance.countDocuments(query),
    ]);

    return sendSuccess(res, {
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/hr/attendance/regularization
export const requestRegularization = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) return sendError(res, 'No linked employee profile', 400);

    const { attendanceId, requestedCheckIn, requestedCheckOut, reason } = req.body;

    const attendance = await Attendance.findOne({ _id: attendanceId, employee: employeeId });
    if (!attendance) {
      return sendError(res, 'Attendance record not found', 404);
    }

    const reg = await AttendanceRegularization.create({
      employee: employeeId,
      attendance: attendanceId,
      date: attendance.date,
      requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null,
      requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
      reason,
      status: 'pending',
    });

    const approval = await createApprovalRequest({
      type: 'regularization',
      referenceModel: 'AttendanceRegularization',
      referenceId: reg._id,
      requestedByEmployeeId: employeeId,
      title: `Attendance Correction for ${new Date(attendance.date).toLocaleDateString()}`,
      metadata: {
        reason,
        date: attendance.date,
        originalStatus: attendance.status,
      },
    });

    reg.approvalRequest = approval._id;
    await reg.save();

    return sendSuccess(res, reg, 'Attendance correction request submitted for approval', 201);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/hr/attendance/:id/manual-edit (HR / Admin override)
export const manualEditAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, checkIn, checkOut, note } = req.body;

    const record = await Attendance.findById(id).populate('employee');
    if (!record) return sendError(res, 'Attendance record not found', 404);

    const oldData = { ...record.toObject() };

    if (status) record.status = status;
    if (checkIn !== undefined) record.checkIn = checkIn ? new Date(checkIn) : null;
    if (checkOut !== undefined) record.checkOut = checkOut ? new Date(checkOut) : null;
    if (note !== undefined) record.note = note;
    record.source = 'manual';

    if (record.checkIn && record.checkOut) {
      const diffMs = new Date(record.checkOut) - new Date(record.checkIn);
      record.workHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    await record.save();

    await logAudit({
      req,
      action: 'MANUAL_EDIT_ATTENDANCE',
      entity: 'Attendance',
      entityId: id,
      changes: { before: oldData, after: req.body },
    });

    return sendSuccess(res, record, 'Attendance updated manually by HR');
  } catch (err) {
    next(err);
  }
};

