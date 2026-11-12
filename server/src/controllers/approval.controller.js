import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { User } from '../models/User.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { handleWorkflowCompletion } from '../services/approvalHandlers.js';
import { notifyUser } from '../services/notification.service.js';

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

    // Fetch all pending requests
    const allPending = await ApprovalRequest.find({ status: 'pending' })
      .populate('requestedBy', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('steps.actedBy', 'email')
      .sort({ createdAt: -1 });

    // Filter to those where the user is eligible for the currentStep
    const pendingForUser = allPending.filter((reqItem) => {
      const stepIndex = reqItem.currentStep - 1;
      const step = reqItem.steps[stepIndex];
      if (!step || step.status !== 'pending') return false;

      // Super admin can act on any step
      if (userRole === 'super_admin') return true;

      // Direct manager assignment
      if (step.approverEmployee && empId && String(step.approverEmployee) === String(empId)) {
        return true;
      }

      // Role assignment (e.g. hr)
      if (step.approverRole && step.approverRole === userRole) {
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
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;

    const approval = await ApprovalRequest.findById(id).populate('requestedBy');
    if (!approval) {
      return sendError(res, 'Approval request not found', 404);
    }

    if (approval.status !== 'pending') {
      return sendError(res, `Request is already ${approval.status}`, 400);
    }

    const stepIndex = approval.currentStep - 1;
    const step = approval.steps[stepIndex];
    if (!step) {
      return sendError(res, 'Invalid approval step', 400);
    }

    // Check permission
    const isEligible =
      req.userRole === 'super_admin' ||
      (step.approverEmployee &&
        req.user.employee &&
        String(step.approverEmployee) === String(req.user.employee._id)) ||
      (step.approverRole && step.approverRole === req.userRole);

    if (!isEligible) {
      return sendError(res, 'You are not authorized to act on this approval step', 403);
    }

    // Mark step approved
    step.status = 'approved';
    step.actedBy = req.user._id;
    step.actedAt = new Date();
    step.comment = comment;

    // Check if more steps remain
    if (approval.currentStep < approval.steps.length) {
      approval.currentStep += 1;
      await approval.save();

      // Notify next approver
      const nextStep = approval.steps[approval.currentStep - 1];
      if (nextStep?.approverRole) {
        const roleUsers = await User.find({ isActive: true }).populate({
          path: 'role',
          match: { key: { $in: [nextStep.approverRole, 'super_admin'] } },
        });
        for (const u of roleUsers) {
          if (u.role) {
            await notifyUser({
              userId: u._id,
              title: `Pending Stage 2: ${approval.title}`,
              message: `Approval forwarded to ${nextStep.title}.`,
              link: '/hr?tab=approvals',
              type: 'approval',
            });
          }
        }
      }
    } else {
      // Final step approved!
      approval.status = 'approved';
      await approval.save();

      // Execute lifecycle hook (e.g. deduct balance, update attendance)
      await handleWorkflowCompletion(approval, 'approved', req.user);

      // Notify requester
      const requesterUser = await User.findOne({ employee: approval.requestedBy._id });
      if (requesterUser) {
        await notifyUser({
          userId: requesterUser._id,
          title: `Request Approved: ${approval.title}`,
          message: `Your ${approval.type} request has been fully approved.`,
          link: '/hr',
          type: 'approval',
        });
      }
    }

    return sendSuccess(res, approval, 'Approval step recorded successfully');
  } catch (err) {
    next(err);
  }
};

export const rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;

    const approval = await ApprovalRequest.findById(id).populate('requestedBy');
    if (!approval) {
      return sendError(res, 'Approval request not found', 404);
    }

    if (approval.status !== 'pending') {
      return sendError(res, `Request is already ${approval.status}`, 400);
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
      return sendError(res, 'You are not authorized to reject this request', 403);
    }

    step.status = 'rejected';
    step.actedBy = req.user._id;
    step.actedAt = new Date();
    step.comment = comment;

    approval.status = 'rejected';
    await approval.save();

    await handleWorkflowCompletion(approval, 'rejected', req.user);

    // Notify requester
    const requesterUser = await User.findOne({ employee: approval.requestedBy._id });
    if (requesterUser) {
      await notifyUser({
        userId: requesterUser._id,
        title: `Request Rejected: ${approval.title}`,
        message: `Your ${approval.type} request was rejected with reason: "${comment || 'No reason provided'}".`,
        link: '/hr',
        type: 'approval',
      });
    }

    return sendSuccess(res, approval, 'Request has been rejected');
  } catch (err) {
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

    if (approval.status !== 'pending') {
      return sendError(res, 'Only pending requests can be cancelled', 400);
    }

    // Only requester can cancel
    if (!req.user.employee || String(approval.requestedBy) !== String(req.user.employee._id)) {
      return sendError(res, 'Only the author of the request can cancel it', 403);
    }

    approval.status = 'cancelled';
    await approval.save();

    await handleWorkflowCompletion(approval, 'cancelled', req.user);

    return sendSuccess(res, approval, 'Request cancelled successfully');
  } catch (err) {
    next(err);
  }
};
