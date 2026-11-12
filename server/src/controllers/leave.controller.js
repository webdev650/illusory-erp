import { LeaveType } from '../models/LeaveType.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Employee } from '../models/Employee.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { countWorkingDays } from '../utils/dateUtils.js';
import { createApprovalRequest } from '../services/approval.service.js';
import { logAudit } from '../middleware/audit.js';

// GET /api/v1/hr/leave/types
export const getLeaveTypes = async (req, res, next) => {
  try {
    const types = await LeaveType.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, types);
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/leave/balances
export const getLeaveBalances = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) return sendSuccess(res, []);

    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    let balances = await LeaveBalance.find({
      employee: employeeId,
      year,
    }).populate('leaveType');

    // If balances don't exist yet for this employee/year, auto-initialize
    if (balances.length === 0) {
      const types = await LeaveType.find({ isActive: true });
      const created = [];
      for (const t of types) {
        const bal = await LeaveBalance.create({
          employee: employeeId,
          leaveType: t._id,
          year,
          allocated: t.yearlyQuota,
          used: 0,
          pending: 0,
          carried: 0,
        });
        bal.leaveType = t;
        created.push(bal);
      }
      balances = created;
    }

    return sendSuccess(res, balances);
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/hr/leave/apply
export const applyLeave = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) {
      return sendError(res, 'No linked employee profile found for your account', 400);
    }

    const { leaveTypeId, fromDate, toDate, isHalfDay = false, reason } = req.body;

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (start > end) {
      return sendError(res, 'Start date cannot be after end date', 400);
    }

    // Calculate working days (excluding weekends and official holidays)
    const days = await countWorkingDays(start, end, isHalfDay);
    if (days <= 0) {
      return sendError(res, 'Selected date range contains no working days (all weekends or holidays)', 400);
    }

    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) {
      return sendError(res, 'Leave type not found', 404);
    }

    const currentYear = start.getFullYear();

    // Find or init balance
    let balance = await LeaveBalance.findOne({
      employee: employeeId,
      leaveType: leaveTypeId,
      year: currentYear,
    });

    if (!balance) {
      balance = await LeaveBalance.create({
        employee: employeeId,
        leaveType: leaveTypeId,
        year: currentYear,
        allocated: leaveType.yearlyQuota,
        used: 0,
        pending: 0,
        carried: 0,
      });
    }

    // Check available balance (unless Unpaid Leave LWP)
    if (leaveType.code !== 'LWP') {
      const available = balance.allocated + balance.carried - balance.used - balance.pending;
      if (available < days) {
        return sendError(
          res,
          `Insufficient leave balance. Requested ${days} days, but only ${available} days available.`,
          400
        );
      }
    }

    // Check for overlapping pending or approved leaves
    const overlap = await LeaveRequest.findOne({
      employee: employeeId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { fromDate: { $lte: end }, toDate: { $gte: start } },
      ],
    });

    if (overlap) {
      return sendError(
        res,
        `You already have an active or approved leave application covering these dates (${new Date(overlap.fromDate).toLocaleDateString()} to ${new Date(overlap.toDate).toLocaleDateString()})`,
        400
      );
    }

    // Create Leave Request
    const leave = await LeaveRequest.create({
      employee: employeeId,
      leaveType: leaveTypeId,
      fromDate: start,
      toDate: end,
      isHalfDay,
      days,
      reason,
      status: 'pending',
    });

    // Update pending balance
    balance.pending += days;
    await balance.save();

    // Trigger Approval Engine workflow
    const approval = await createApprovalRequest({
      type: 'leave',
      referenceModel: 'LeaveRequest',
      referenceId: leave._id,
      requestedByEmployeeId: employeeId,
      title: `${leaveType.name} Request (${days} ${days === 1 ? 'day' : 'days'})`,
      metadata: {
        leaveTypeName: leaveType.name,
        days,
        fromDate: start,
        toDate: end,
        reason,
        isHalfDay,
      },
    });

    leave.approvalRequest = approval._id;
    await leave.save();

    return sendSuccess(res, leave, 'Leave application submitted for approval', 201);
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/leave/my-requests
export const getMyLeaveRequests = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) return sendSuccess(res, []);

    const requests = await LeaveRequest.find({ employee: employeeId })
      .populate('leaveType')
      .populate('approvalRequest')
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests);
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/hr/leave/:id/cancel
export const cancelLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.employee?._id;

    const leave = await LeaveRequest.findOne({ _id: id, employee: employeeId });
    if (!leave) {
      return sendError(res, 'Leave request not found', 404);
    }

    if (leave.status !== 'pending') {
      return sendError(res, 'Only pending leave requests can be cancelled directly', 400);
    }

    leave.status = 'cancelled';
    await leave.save();

    // Reclaim pending balance
    const currentYear = new Date(leave.fromDate).getFullYear();
    const balance = await LeaveBalance.findOne({
      employee: employeeId,
      leaveType: leave.leaveType,
      year: currentYear,
    });

    if (balance) {
      balance.pending = Math.max(0, balance.pending - leave.days);
      await balance.save();
    }

    return sendSuccess(res, leave, 'Leave request cancelled successfully');
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/leave/calendar (View approved leaves)
export const getLeaveCalendar = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const now = new Date();
    const targetMonth = month ? parseInt(month, 10) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year, 10) : now.getFullYear();

    const start = new Date(targetYear, targetMonth, 1);
    const end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const leaves = await LeaveRequest.find({
      status: 'approved',
      fromDate: { $lte: end },
      toDate: { $gte: start },
    })
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation employment.department')
      .populate('leaveType', 'name code')
      .sort({ fromDate: 1 });

    return sendSuccess(res, leaves);
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/leave/all (HR / Admin view)
export const getAllLeaveRequests = async (req, res, next) => {
  try {
    const { status, department, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;

    if (department) {
      const deptEmps = await Employee.find({
        'employment.department': department,
        isDeleted: false,
      }).select('_id');
      query.employee = { $in: deptEmps.map((e) => e._id) };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [requests, total] = await Promise.all([
      LeaveRequest.find(query)
        .populate({
          path: 'employee',
          select: 'personal.firstName personal.lastName employeeId employment.designation employment.department',
          populate: { path: 'employment.department', select: 'name code' },
        })
        .populate('leaveType')
        .populate('approvalRequest')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      LeaveRequest.countDocuments(query),
    ]);

    return sendSuccess(res, {
      requests,
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

