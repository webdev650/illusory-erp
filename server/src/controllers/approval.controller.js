import mongoose from 'mongoose';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { User } from '../models/User.js';
import { Delegation } from '../models/Delegation.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { handleWorkflowCompletion } from '../services/approvalHandlers.js';
import { notifyUser } from '../services/notification.service.js';
import { reassignApprovalStep } from '../services/approval.service.js';

export const getMyRequests = async (req, res, next) => {
  try {
    if (!req.user.employee) {
      return sendSuccess(res, [], 'No employee profile linked');
    }

    const requests = await ApprovalRequest.find({
      requestedBy: req.user.employee._id,
    })
      .populate('requestedBy', 'personal.firstName personal.lastName employeeId')
      .populate('steps.actedBy', 'email')
      .populate('steps.approverEmployee', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'My approval requests retrieved');
  } catch (err) {
    next(err);
  }
};

export const getPendingForMe = async (req, res, next) => {
  try {
    const userRole = req.userRole; // e.g. 'super_admin', 'hr', 'employee'
    const empId = req.user.employee?._id;

    const allPending = await ApprovalRequest.find({ status: 'pending' })
      .populate('requestedBy', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('steps.actedBy', 'email')
      .populate('steps.approverEmployee', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 });

    const pendingForUser = allPending.filter((reqItem) => {
      // Check zero self-approval: requester cannot act on their own request
      if (empId && String(reqItem.requestedBy?._id || reqItem.requestedBy) === String(empId)) {
        return false;
      }

      const stepIndex = reqItem.currentStep - 1;
      const step = reqItem.steps[stepIndex];
      if (!step || step.status !== 'pending') return false;

      // Super admin can act on any step (except their own request)
      if (userRole === 'super_admin') return true;

      // Direct assignment
      if (step.approverEmployee && empId && String(step.approverEmployee._id || step.approverEmployee) === String(empId)) {
        return true;
      }

      // Role assignment
      if (step.approverRole && (step.approverRole === userRole || (userRole === 'hr' && step.approverRole === 'hr'))) {
        return true;
      }

      return false;
    });

    return sendSuccess(res, pendingForUser, 'Pending approvals retrieved');
  } catch (err) {
    next(err);
  }
};

export const approveRequest = async (req, res, next) => {
  let session = null;
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;

    const approvalCheck = await ApprovalRequest.findById(id);
    if (!approvalCheck) {
      return sendError(res, 'Approval request not found', 404);
    }

    // STRICT RULE: Zero self-approval across ALL roles
    if (req.user.employee && String(approvalCheck.requestedBy) === String(req.user.employee._id)) {
      return sendError(res, 'Self-approval is strictly forbidden', 403);
    }

    if (approvalCheck.status !== 'pending') {
      return sendError(res, `Request is already ${approvalCheck.status}`, 400);
    }

    // Start MongoDB transaction if supported
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    // Concurrency guard: find and lock the request atomically at the current pending step
    const query = {
      _id: id,
      status: 'pending',
      currentStep: approvalCheck.currentStep,
    };
    const approval = session
      ? await ApprovalRequest.findOne(query).session(session).populate('requestedBy')
      : await ApprovalRequest.findOne(query).populate('requestedBy');

    if (!approval) {
      if (session) await session.abortTransaction();
      return sendError(res, 'Request has already been processed or step changed by another approver', 409);
    }

    const stepIndex = approval.currentStep - 1;
    const step = approval.steps[stepIndex];
    if (!step) {
      if (session) await session.abortTransaction();
      return sendError(res, 'Invalid approval step', 400);
    }

    const isEligible =
      req.userRole === 'super_admin' ||
      (step.approverEmployee &&
        req.user.employee &&
        String(step.approverEmployee) === String(req.user.employee._id)) ||
      (step.approverRole && step.approverRole === req.userRole);

    if (!isEligible) {
      if (session) await session.abortTransaction();
      return sendError(res, 'You are not authorized to act on this approval step', 403);
    }

    // Mark step approved
    step.status = 'approved';
    step.actedBy = req.user._id;
    step.actedAt = new Date();
    step.comment = comment;

    let isFinalStep = false;
    if (approval.currentStep < approval.steps.length) {
      approval.currentStep += 1;
    } else {
      approval.status = 'approved';
      isFinalStep = true;
    }

    await approval.save(session ? { session } : undefined);

    if (session) {
      await session.commitTransaction();
      session.endSession();
      session = null;
    }

    // Post-commit workflow handling
    if (isFinalStep) {
      await handleWorkflowCompletion(approval, 'approved', req.user);

      const requesterUser = await User.findOne({ employee: approval.requestedBy?._id || approval.requestedBy });
      if (requesterUser) {
        await notifyUser({
          userId: requesterUser._id,
          title: `Request Approved: ${approval.title}`,
          message: `Your ${approval.type} request has been fully approved.`,
          link: '/hrms/attendance',
          type: 'approval',
        });
      }
    } else {
      // Forward to next step
      const nextStep = approval.steps[approval.currentStep - 1];
      if (nextStep?.approverRole) {
        const roleUsers = await User.find({ isActive: true }).populate({
          path: 'role',
          match: { key: { $in: [nextStep.approverRole, 'super_admin'] } },
        });
        for (const u of roleUsers.filter((u) => u.role)) {
          await notifyUser({
            userId: u._id,
            title: `Pending Stage ${approval.currentStep}: ${approval.title}`,
            message: `Approval forwarded to ${nextStep.title}.`,
            link: '/hrms/attendance',
            type: 'approval',
          });
        }
      }
    }

    return sendSuccess(res, approval, 'Approval step recorded successfully');
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(err);
  }
};

export const rejectRequest = async (req, res, next) => {
  let session = null;
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;

    const approvalCheck = await ApprovalRequest.findById(id);
    if (!approvalCheck) {
      return sendError(res, 'Approval request not found', 404);
    }

    // Zero self-approval
    if (req.user.employee && String(approvalCheck.requestedBy) === String(req.user.employee._id)) {
      return sendError(res, 'Self-rejection is strictly forbidden. Please cancel your request instead.', 403);
    }

    if (approvalCheck.status !== 'pending') {
      return sendError(res, `Request is already ${approvalCheck.status}`, 400);
    }

    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    const query = {
      _id: id,
      status: 'pending',
      currentStep: approvalCheck.currentStep,
    };
    const approval = session
      ? await ApprovalRequest.findOne(query).session(session).populate('requestedBy')
      : await ApprovalRequest.findOne(query).populate('requestedBy');

    if (!approval) {
      if (session) await session.abortTransaction();
      return sendError(res, 'Request has already been processed by another approver', 409);
    }

    const stepIndex = approval.currentStep - 1;
    const step = approval.steps[stepIndex];

    const isEligible =
      req.userRole === 'super_admin' ||
      (step.approverEmployee &&
        req.user.employee &&
        String(step.approverEmployee) === String(req.user.employee._id)) ||
      (step.approverRole && step.approverRole === req.userRole);

    if (!isEligible) {
      if (session) await session.abortTransaction();
      return sendError(res, 'You are not authorized to reject this request', 403);
    }

    step.status = 'rejected';
    step.actedBy = req.user._id;
    step.actedAt = new Date();
    step.comment = comment;

    approval.status = 'rejected';
    await approval.save(session ? { session } : undefined);

    if (session) {
      await session.commitTransaction();
      session.endSession();
      session = null;
    }

    await handleWorkflowCompletion(approval, 'rejected', req.user);

    const requesterUser = await User.findOne({ employee: approval.requestedBy?._id || approval.requestedBy });
    if (requesterUser) {
      await notifyUser({
        userId: requesterUser._id,
        title: `Request Rejected: ${approval.title}`,
        message: `Your ${approval.type} request was rejected with reason: "${comment || 'No reason provided'}".`,
        link: '/hrms/attendance',
        type: 'approval',
      });
    }

    return sendSuccess(res, approval, 'Request has been rejected');
  } catch (err) {
    if (session) {
      await session.abortTransaction();
      session.endSession();
    }
    next(err);
  }
};

export const cancelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const approval = await ApprovalRequest.findById(id);
    if (!approval) {
      return sendError(res, 'Approval request not found', 404);
    }

    const isRequester = req.user.employee && String(approval.requestedBy) === String(req.user.employee._id);
    const isHrOrAdmin = ['super_admin', 'hr'].includes(req.userRole);

    if (!isRequester && !isHrOrAdmin) {
      return sendError(res, 'Only the author of the request or HR/Admin can cancel it', 403);
    }

    if (approval.status === 'cancelled') {
      return sendError(res, 'Request is already cancelled', 400);
    }

    // Cancellation of approved request is permitted for HR/Admin to revert
    if (approval.status === 'approved' && !isHrOrAdmin) {
      return sendError(res, 'Only HR or Super Admin can cancel an already approved request', 403);
    }

    const previousStatus = approval.status;
    approval.status = 'cancelled';
    await approval.save();

    await handleWorkflowCompletion(approval, 'cancelled', req.user);

    return sendSuccess(res, approval, `Request successfully cancelled (was ${previousStatus})`);
  } catch (err) {
    next(err);
  }
};

export const reassignApprover = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetEmployeeId, targetRole, comment } = req.body;

    if (!['super_admin', 'hr'].includes(req.userRole)) {
      return sendError(res, 'Only HR and Super Admin can reassign approvers', 403);
    }

    const updated = await reassignApprovalStep({
      approvalId: id,
      targetEmployeeId,
      targetRole,
      comment,
      actedByUser: req.user,
    });

    return sendSuccess(res, updated, 'Approver reassigned successfully');
  } catch (err) {
    next(err);
  }
};

export const bulkAction = async (req, res, next) => {
  try {
    const { ids = [], action = 'approve', comment = '' } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'A non-empty list of IDs is required', 400);
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const reqId of ids) {
      try {
        const approval = await ApprovalRequest.findById(reqId);
        if (!approval) {
          results.failed.push({ id: reqId, reason: 'Not found' });
          continue;
        }

        // Check self-approval
        if (req.user.employee && String(approval.requestedBy) === String(req.user.employee._id)) {
          results.failed.push({ id: reqId, reason: 'Self-action forbidden' });
          continue;
        }

        if (approval.status !== 'pending') {
          results.failed.push({ id: reqId, reason: `Already ${approval.status}` });
          continue;
        }

        const stepIndex = approval.currentStep - 1;
        const step = approval.steps[stepIndex];
        const isEligible =
          req.userRole === 'super_admin' ||
          (step.approverEmployee &&
            req.user.employee &&
            String(step.approverEmployee) === String(req.user.employee._id)) ||
          (step.approverRole && step.approverRole === req.userRole);

        if (!isEligible) {
          results.failed.push({ id: reqId, reason: 'Unauthorized for this step' });
          continue;
        }

        step.status = action === 'approve' ? 'approved' : 'rejected';
        step.actedBy = req.user._id;
        step.actedAt = new Date();
        step.comment = comment;

        let isFinal = false;
        if (action === 'approve') {
          if (approval.currentStep < approval.steps.length) {
            approval.currentStep += 1;
          } else {
            approval.status = 'approved';
            isFinal = true;
          }
        } else {
          approval.status = 'rejected';
          isFinal = true;
        }

        await approval.save();

        if (isFinal) {
          await handleWorkflowCompletion(approval, approval.status, req.user);
        }

        results.successful.push({ id: reqId, status: approval.status });
      } catch (e) {
        results.failed.push({ id: reqId, reason: e.message });
      }
    }

    return sendSuccess(res, results, `Processed ${results.successful.length} of ${ids.length} requests`);
  } catch (err) {
    next(err);
  }
};

// Delegations
export const getMyDelegations = async (req, res, next) => {
  try {
    if (!req.user.employee) return sendSuccess(res, []);
    const delegations = await Delegation.find({ approver: req.user.employee._id })
      .populate('delegate', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 });
    return sendSuccess(res, delegations, 'Delegations retrieved');
  } catch (err) {
    next(err);
  }
};

export const setDelegation = async (req, res, next) => {
  try {
    if (!req.user.employee) return sendError(res, 'No employee profile linked', 400);
    const { delegateId, fromDate, toDate, reason = '' } = req.body;

    if (!delegateId || !fromDate || !toDate) {
      return sendError(res, 'Delegate, fromDate, and toDate are required', 400);
    }

    if (String(delegateId) === String(req.user.employee._id)) {
      return sendError(res, 'Cannot delegate to yourself', 400);
    }

    const delegation = await Delegation.create({
      approver: req.user.employee._id,
      delegate: delegateId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
      isActive: true,
    });

    return sendSuccess(res, delegation, 'Approval delegation configured successfully');
  } catch (err) {
    next(err);
  }
};
