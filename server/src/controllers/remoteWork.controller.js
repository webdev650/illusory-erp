import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { Employee } from '../models/Employee.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { createApprovalRequest } from '../services/approval.service.js';
import { logAudit } from '../middleware/audit.js';

// POST /api/v1/hr/remote-work/apply
export const applyRemoteWork = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) {
      return sendError(res, 'No linked employee profile found for your account', 400);
    }

    const { fromDate, toDate, reason, contactPhone } = req.body;

    if (!fromDate || !toDate || !reason) {
      return sendError(res, 'From date, to date, and reason are required', 400);
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (start > end) {
      return sendError(res, 'Start date cannot be after end date', 400);
    }

    // Calculate days inclusive
    const diffTime = Math.abs(end - start);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check for overlapping active request
    const overlap = await RemoteWorkRequest.findOne({
      employee: employeeId,
      status: { $in: ['pending', 'approved'] },
      $or: [{ fromDate: { $lte: end }, toDate: { $gte: start } }],
    });

    if (overlap) {
      return sendError(
        res,
        `You already have an active remote work application for these dates (${new Date(overlap.fromDate).toLocaleDateString()} to ${new Date(overlap.toDate).toLocaleDateString()})`,
        400
      );
    }

    const rw = await RemoteWorkRequest.create({
      employee: employeeId,
      fromDate: start,
      toDate: end,
      days,
      reason,
      contactPhone: contactPhone || req.user.employee?.personal?.phone || '',
      status: 'pending',
    });

    // Trigger Approval Engine
    const approval = await createApprovalRequest({
      type: 'remote_work',
      referenceModel: 'RemoteWorkRequest',
      referenceId: rw._id,
      requestedByEmployeeId: employeeId,
      title: `Remote Work Request (${days} ${days === 1 ? 'day' : 'days'})`,
      metadata: {
        fromDate: start,
        toDate: end,
        days,
        reason,
        contactPhone,
      },
    });

    rw.approvalRequest = approval._id;
    await rw.save();

    await logAudit({
      userId: req.user._id,
      action: 'CREATE',
      resource: 'RemoteWorkRequest',
      resourceId: rw._id,
      description: `Applied for ${days} days of remote work: ${reason}`,
      req,
    });

    return sendSuccess(
      res,
      rw,
      `Remote work application for ${days} ${days === 1 ? 'day' : 'days'} submitted for manager approval.`,
      201
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/remote-work/my
export const getMyRemoteWorkRequests = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    if (!employeeId) return sendSuccess(res, []);

    const requests = await RemoteWorkRequest.find({ employee: employeeId })
      .populate('approvalRequest')
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests);
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/hr/remote-work/all (HR/Admin)
export const getAllRemoteWorkRequests = async (req, res, next) => {
  try {
    const { status, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.fromDate = {};
      if (from) filter.fromDate.$gte = new Date(from);
      if (to) filter.fromDate.$lte = new Date(to);
    }

    const requests = await RemoteWorkRequest.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('approvalRequest')
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/v1/hr/remote-work/:id/cancel
export const cancelRemoteWork = async (req, res, next) => {
  try {
    const employeeId = req.user.employee?._id;
    const { id } = req.params;

    const rw = await RemoteWorkRequest.findById(id);
    if (!rw) return sendError(res, 'Remote work request not found', 404);

    if (rw.employee.toString() !== employeeId?.toString() && req.user.role.key !== 'super_admin') {
      return sendError(res, 'Not authorized to cancel this request', 403);
    }

    if (rw.status !== 'pending') {
      return sendError(res, `Cannot cancel a request that is already ${rw.status}`, 400);
    }

    rw.status = 'cancelled';
    await rw.save();

    return sendSuccess(res, rw, 'Remote work request cancelled');
  } catch (err) {
    next(err);
  }
};
