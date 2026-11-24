import mongoose from 'mongoose';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Delegation } from '../models/Delegation.js';
import { WorkflowConfig } from '../models/WorkflowConfig.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import { notifyUser, notifyEmployee } from '../services/notification.service.js';
import { approvalRegistry } from '../services/approvalRegistry.js';
import {
  calculateSlaDueDate,
  evaluateUrgency,
  getApprovalEmployeeContext,
} from '../services/approvalEscalation.service.js';

/**
 * 1. GET Universal Approvals Inbox
 * GET /api/v1/approvals/inbox?tab=&type=&status=&from=&to=&employee=&department=&urgency=&page=&limit=
 * Tabs:
 * - 'waiting': Requests where current step belongs to req.user (directly or via delegation). Default.
 * - 'all_pending': (HR & Super Admin only) Every pending request in the organization.
 * - 'my_team': (Managers & Leads) Pending/recent requests from direct reports.
 * - 'history': Approved, rejected, cancelled, returned requests.
 * - 'raised_by_me': My own requests and status.
 */
export const getApprovalInbox = async (req, res, next) => {
  try {
    const {
      tab = 'waiting',
      type,
      status,
      from,
      to,
      employee,
      department,
      urgency,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const userRole = req.userRole || (req.user?.role?.key || 'employee');
    const isSuperAdmin = userRole === 'super_admin';
    const isHR = userRole === 'hr';
    const myEmpId = req.user.employee?._id;

    // Check active delegations where current user is delegate
    const now = new Date();
    const activeDelegations = myEmpId
      ? await Delegation.find({
          delegate: myEmpId,
          isActive: true,
          fromDate: { $lte: now },
          toDate: { $gte: now },
        })
      : [];
    const delegatedApproverIds = activeDelegations.map((d) => d.approver);

    let query = {};

    // 1. Tab Scoping
    if (tab === 'waiting') {
      // Current step belongs to me directly or by delegation, status pending, zero self-approval
      query.status = 'pending';

      const approverMatchConditions = [];
      if (myEmpId) {
        approverMatchConditions.push({ 'steps.approverEmployee': myEmpId });
        if (delegatedApproverIds.length > 0) {
          approverMatchConditions.push({ 'steps.approverEmployee': { $in: delegatedApproverIds } });
        }
      }

      if (isHR) {
        approverMatchConditions.push({ 'steps.approverRole': 'hr' });
      }
      if (isSuperAdmin) {
        approverMatchConditions.push({ 'steps.approverRole': 'super_admin' });
      }

      if (!isSuperAdmin) {
        if (approverMatchConditions.length > 0) {
          query.$or = approverMatchConditions;
        } else {
          query._id = new mongoose.Types.ObjectId(); // Empty match
        }
      }

      // Strictly zero self-approval: I cannot approve my own requests
      if (myEmpId) {
        query.requestedBy = { $ne: myEmpId };
      }
    } else if (tab === 'all_pending') {
      if (!isSuperAdmin && !isHR) {
        return sendError(res, 'Access denied: All Pending queue restricted to HR and Super Admin', 403);
      }
      query.status = 'pending';
    } else if (tab === 'my_team') {
      if (!myEmpId) {
        return sendSuccess(res, { requests: [], pagination: { total: 0, page: 1, pages: 1 } }, 'No team requests');
      }
      const directReports = await Employee.find({
        'employment.reportingManager': myEmpId,
        isDeleted: false,
      }).select('_id');
      const reportIds = directReports.map((r) => r._id);
      query.requestedBy = { $in: reportIds };
    } else if (tab === 'history') {
      query.status = { $in: ['approved', 'rejected', 'cancelled', 'returned'] };
      if (!isSuperAdmin && !isHR) {
        // Non-admin sees history where they requested or acted
        const orClauses = [];
        if (myEmpId) orClauses.push({ requestedBy: myEmpId }, { 'steps.actedBy': req.user._id });
        query.$or = orClauses.length > 0 ? orClauses : [{ requestedBy: myEmpId }];
      }
    } else if (tab === 'raised_by_me') {
      if (!myEmpId) {
        return sendSuccess(res, { requests: [], pagination: { total: 0, page: 1, pages: 1 } }, 'No requests raised');
      }
      query.requestedBy = myEmpId;
    }

    // 2. Multi-Filter Facets
    if (type && type !== 'all') {
      query.type = { $in: Array.isArray(type) ? type : type.split(',') };
    }

    if (status && status !== 'all' && tab !== 'waiting' && tab !== 'all_pending') {
      query.status = status;
    }

    if (urgency && urgency !== 'all') {
      query.urgency = urgency;
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDate;
      }
    }

    if (employee) {
      query.requestedBy = employee;
    }

    // Department filtering
    if (department && department !== 'all') {
      const deptEmployees = await Employee.find({ 'employment.department': department }).select('_id');
      const empIds = deptEmployees.map((e) => e._id);
      query.requestedBy = { $in: empIds };
    }

    // Search query on title or metadata
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'metadata.notes': { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawRequests] = await Promise.all([
      ApprovalRequest.countDocuments(query),
      ApprovalRequest.find(query)
        .populate('requestedBy', 'personal.firstName personal.lastName employeeId personal.avatar employment.designation employment.department')
        .populate('steps.approverEmployee', 'personal.firstName personal.lastName employeeId')
        .populate('steps.actedBy', 'email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    // Format requests with Registry summaries and live waiting metadata
    const requests = rawRequests.map((r) => {
      const reg = approvalRegistry.get(r.type);
      const stepIdx = r.currentStep - 1;
      const currentStepObj = r.steps[stepIdx] || {};

      let waitingOnPerson = 'Completed';
      if (r.status === 'pending') {
        if (currentStepObj.approverEmployee) {
          waitingOnPerson = `${currentStepObj.approverEmployee.personal?.firstName} ${currentStepObj.approverEmployee.personal?.lastName}`;
        } else if (currentStepObj.approverRole) {
          waitingOnPerson = currentStepObj.approverRole.toUpperCase();
        }
      }

      // Days pending
      const daysPending = Math.max(0, Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)));

      return {
        _id: r._id,
        type: r.type,
        typeLabel: reg?.label || r.type,
        typeIcon: reg?.icon || 'FileText',
        typeColour: reg?.colour || 'slate',
        module: reg?.module || 'HRMS',
        title: r.title,
        summary: reg?.renderSummary ? reg.renderSummary(r) : r.title,
        status: r.status,
        version: r.version || 1,
        urgency: r.urgency || evaluateUrgency(r.dueDate),
        dueDate: r.dueDate,
        daysPending,
        waitingOn: waitingOnPerson,
        isDelegated: delegatedApproverIds.some((id) => String(id) === String(currentStepObj.approverEmployee?._id)),
        requestedBy: r.requestedBy,
        currentStep: r.currentStep,
        totalSteps: r.steps.length,
        createdAt: r.createdAt,
      };
    });

    return sendSuccess(
      res,
      {
        requests,
        pagination: {
          total,
          page: pageNum,
          pages: Math.ceil(total / limitNum) || 1,
          limit: limitNum,
        },
      },
      'Approvals inbox retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2. GET Live Badge and Tab Counts
 * GET /api/v1/approvals/counts
 */
export const getApprovalCounts = async (req, res, next) => {
  try {
    const userRole = req.userRole || (req.user?.role?.key || 'employee');
    const isSuperAdmin = userRole === 'super_admin';
    const isHR = userRole === 'hr';
    const myEmpId = req.user.employee?._id;

    const now = new Date();
    const activeDelegations = myEmpId
      ? await Delegation.find({
          delegate: myEmpId,
          isActive: true,
          fromDate: { $lte: now },
          toDate: { $gte: now },
        })
      : [];
    const delegatedApproverIds = activeDelegations.map((d) => d.approver);

    // 1. Waiting for me
    let waitingQuery = { status: 'pending' };
    const approverMatchConditions = [];
    if (myEmpId) {
      approverMatchConditions.push({ 'steps.approverEmployee': myEmpId });
      if (delegatedApproverIds.length > 0) {
        approverMatchConditions.push({ 'steps.approverEmployee': { $in: delegatedApproverIds } });
      }
    }
    if (isHR) approverMatchConditions.push({ 'steps.approverRole': 'hr' });
    if (isSuperAdmin) approverMatchConditions.push({ 'steps.approverRole': 'super_admin' });

    if (!isSuperAdmin) {
      if (approverMatchConditions.length > 0) waitingQuery.$or = approverMatchConditions;
      else waitingQuery._id = new mongoose.Types.ObjectId();
    }
    if (myEmpId) waitingQuery.requestedBy = { $ne: myEmpId };

    const waitingCount = await ApprovalRequest.countDocuments(waitingQuery);

    // 2. All pending (HR/Admin)
    const allPendingCount = (isSuperAdmin || isHR)
      ? await ApprovalRequest.countDocuments({ status: 'pending' })
      : 0;

    // 3. My Team
    let myTeamCount = 0;
    if (myEmpId) {
      const directReports = await Employee.find({
        'employment.reportingManager': myEmpId,
        isDeleted: false,
      }).select('_id');
      const reportIds = directReports.map((r) => r._id);
      myTeamCount = await ApprovalRequest.countDocuments({
        requestedBy: { $in: reportIds },
        status: 'pending',
      });
    }

    // 4. Raised by me
    const raisedByMeCount = myEmpId
      ? await ApprovalRequest.countDocuments({ requestedBy: myEmpId, status: 'pending' })
      : 0;

    return sendSuccess(
      res,
      {
        waitingForMe: waitingCount,
        allPending: allPendingCount,
        myTeam: myTeamCount,
        raisedByMe: raisedByMeCount,
      },
      'Approval counts retrieved'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 3. GET Approval Details by ID (Detail Drawer)
 * GET /api/v1/approvals/:id
 */
export const getApprovalDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const approval = await ApprovalRequest.findById(id)
      .populate('requestedBy')
      .populate('steps.approverEmployee', 'personal.firstName personal.lastName employeeId personal.avatar')
      .populate('steps.actedBy', 'email')
      .populate('comments.author', 'email personal.firstName personal.lastName');

    if (!approval) return sendError(res, 'Approval request not found', 404);

    const userRole = req.userRole || (req.user?.role?.key || 'employee');
    const isSuperAdmin = userRole === 'super_admin';
    const isHR = userRole === 'hr';
    const myEmpId = req.user.employee?._id;

    // RBAC Check: Ensure user has permission to view this specific item
    const isRequester = myEmpId && String(approval.requestedBy?._id) === String(myEmpId);
    const isApproverOnStep = approval.steps.some(
      (s) => myEmpId && String(s.approverEmployee?._id || s.approverEmployee) === String(myEmpId)
    );

    if (!isSuperAdmin && !isHR && !isRequester && !isApproverOnStep) {
      return sendError(res, 'Access denied: You are not authorized to view this approval request', 403);
    }

    const reg = approvalRegistry.get(approval.type);
    let details = {};
    if (reg?.fetchDetails) {
      try {
        details = await reg.fetchDetails(approval.referenceId);
      } catch (detErr) {
        details = { error: detErr.message };
      }
    }

    // Get employee context card & absence clashes
    let context = {};
    try {
      context = await getApprovalEmployeeContext(approval._id);
    } catch (ctxErr) {
      console.warn('Context fetch error:', ctxErr.message);
    }

    return sendSuccess(
      res,
      {
        approval,
        registryConfig: {
          key: reg?.key || approval.type,
          label: reg?.label || approval.type,
          icon: reg?.icon || 'FileText',
          colour: reg?.colour || 'slate',
          module: reg?.module || 'HRMS',
        },
        details,
        context,
      },
      'Approval details retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 4. POST Approve Request
 * POST /api/v1/approvals/:id/approve
 */
export const approveRequestAction = async (req, res, next) => {
  let session = null;
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;

    const approval = await ApprovalRequest.findById(id);
    if (!approval) return sendError(res, 'Approval request not found', 404);

    // STRICT ZERO SELF-APPROVAL
    if (req.user.employee && String(approval.requestedBy) === String(req.user.employee._id)) {
      return sendError(res, 'Self-approval is strictly forbidden across all roles', 403);
    }

    if (approval.status !== 'pending') {
      return sendError(res, `Request is already ${approval.status}`, 400);
    }

    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    const currentStepIndex = approval.currentStep - 1;
    const currentStep = approval.steps[currentStepIndex];

    if (!currentStep || currentStep.status !== 'pending') {
      if (session) await session.abortTransaction();
      return sendError(res, 'Invalid current approval step state', 400);
    }

    currentStep.status = 'approved';
    currentStep.actedBy = req.user._id;
    currentStep.actedAt = new Date();
    currentStep.comment = comment;

    approval.timeline.push({
      action: 'APPROVED_STEP',
      performedBy: req.user._id,
      performedByName: req.user.email,
      comment: comment || `Approved step ${approval.currentStep}`,
      timestamp: new Date(),
    });

    const isFinalStep = approval.currentStep >= approval.steps.length;

    if (isFinalStep) {
      approval.status = 'approved';
      if (session) await approval.save({ session });
      else await approval.save();

      // Execute registry onApproved callback
      const reg = approvalRegistry.get(approval.type);
      if (reg?.onApproved) {
        await reg.onApproved(approval, req.user);
      }
    } else {
      approval.currentStep += 1;
      if (session) await approval.save({ session });
      else await approval.save();
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    await logAudit({
      req,
      action: isFinalStep ? 'APPROVE_REQUEST_FINAL' : 'APPROVE_REQUEST_STEP',
      entity: 'ApprovalRequest',
      entityId: approval._id,
      changes: {
        step: currentStepIndex + 1,
        final: isFinalStep,
        comment,
      },
    });

    return sendSuccess(
      res,
      approval,
      isFinalStep ? 'Approval finalized successfully' : 'Approval step passed to next reviewer'
    );
  } catch (err) {
    if (session) await session.abortTransaction();
    next(err);
  }
};

/**
 * 5. POST Reject Request
 * POST /api/v1/approvals/:id/reject
 */
export const rejectRequestAction = async (req, res, next) => {
  let session = null;
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;

    if (!comment.trim()) {
      return sendError(res, 'A clear reason/comment is mandatory when rejecting a request', 400);
    }

    const approval = await ApprovalRequest.findById(id);
    if (!approval) return sendError(res, 'Approval request not found', 404);

    if (req.user.employee && String(approval.requestedBy) === String(req.user.employee._id)) {
      return sendError(res, 'Self-rejection / self-action is forbidden', 403);
    }

    if (approval.status !== 'pending') {
      return sendError(res, `Request is already ${approval.status}`, 400);
    }

    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    const currentStepIndex = approval.currentStep - 1;
    const currentStep = approval.steps[currentStepIndex];

    if (currentStep) {
      currentStep.status = 'rejected';
      currentStep.actedBy = req.user._id;
      currentStep.actedAt = new Date();
      currentStep.comment = comment;
    }

    approval.status = 'rejected';
    approval.timeline.push({
      action: 'REJECTED',
      performedBy: req.user._id,
      performedByName: req.user.email,
      comment,
      timestamp: new Date(),
    });

    if (session) await approval.save({ session });
    else await approval.save();

    // Execute registry onRejected callback
    const reg = approvalRegistry.get(approval.type);
    if (reg?.onRejected) {
      await reg.onRejected(approval, req.user);
    }

    if (session) {
      await session.commitTransaction();
      session.endSession();
    }

    await logAudit({
      req,
      action: 'REJECT_REQUEST',
      entity: 'ApprovalRequest',
      entityId: approval._id,
      changes: { comment },
    });

    return sendSuccess(res, approval, 'Request rejected and balances/records restored successfully');
  } catch (err) {
    if (session) await session.abortTransaction();
    next(err);
  }
};

/**
 * 6. POST Return for Correction
 * POST /api/v1/approvals/:id/return
 */
export const returnRequestAction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment = '' } = req.body;

    if (!comment.trim()) {
      return sendError(res, 'A comment detailing the requested correction is required', 400);
    }

    const approval = await ApprovalRequest.findById(id);
    if (!approval) return sendError(res, 'Approval request not found', 404);

    if (approval.status !== 'pending') {
      return sendError(res, `Only pending requests can be returned for correction`, 400);
    }

    approval.status = 'returned';
    approval.returnComment = comment;
    approval.returnedAt = new Date();
    approval.version = (approval.version || 1) + 1;

    approval.timeline.push({
      action: 'RETURNED',
      performedBy: req.user._id,
      performedByName: req.user.email,
      comment,
      timestamp: new Date(),
    });

    await approval.save();

    // Call registry onReturned callback
    const reg = approvalRegistry.get(approval.type);
    if (reg?.onReturned) {
      await reg.onReturned(approval, req.user, comment);
    }

    // Notify requester
    try {
      await notifyEmployee(approval.requestedBy, {
        title: `Returned for Correction: ${approval.title}`,
        message: `Your request was returned by reviewer. Reason: ${comment}`,
        type: 'approval_returned',
        link: `/hrms/approvals?id=${approval._id}`,
      });
    } catch (notifErr) {
      console.warn('Notification failed during return:', notifErr.message);
    }

    try {
      await logAudit({
        req,
        action: 'RETURN_REQUEST_FOR_CORRECTION',
        entity: 'ApprovalRequest',
        entityId: approval._id,
        changes: { comment, newVersion: approval.version },
      });
    } catch (auditErr) {
      console.warn('Audit log failed during returnRequestAction:', auditErr.message);
    }

    return sendSuccess(res, approval, 'Request returned for correction to applicant');
  } catch (err) {
    next(err);
  }
};

/**
 * 7. POST Add Comment to Approval
 * POST /api/v1/approvals/:id/comment
 */
export const addApprovalComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text = '', isInternal = false } = req.body;

    if (!text.trim()) return sendError(res, 'Comment text is required', 400);

    const approval = await ApprovalRequest.findById(id);
    if (!approval) return sendError(res, 'Approval request not found', 404);

    approval.comments.push({
      author: req.user._id,
      authorName: req.user.email,
      text,
      isInternal: Boolean(isInternal),
      createdAt: new Date(),
    });

    approval.timeline.push({
      action: 'COMMENTED',
      performedBy: req.user._id,
      performedByName: req.user.email,
      comment: text,
      metadata: { isInternal },
      timestamp: new Date(),
    });

    await approval.save();

    return sendSuccess(res, approval.comments, 'Comment added successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 8. POST Bulk Action (Approve / Reject)
 * POST /api/v1/approvals/bulk
 * Checks each item individually for scope, self-approval, and step ownership.
 */
export const bulkApprovalAction = async (req, res, next) => {
  try {
    const { action, ids = [], comment = '' } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return sendError(res, 'Invalid bulk action. Must be "approve" or "reject"', 400);
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return sendError(res, 'At least one request ID must be selected', 400);
    }

    if (action === 'reject' && !comment.trim()) {
      return sendError(res, 'Rejection comment is mandatory for bulk rejection', 400);
    }

    const succeeded = [];
    const skipped = [];
    const failed = [];

    const userRole = req.userRole || (req.user?.role?.key || 'employee');
    const isSuperAdmin = userRole === 'super_admin';
    const isHR = userRole === 'hr';
    const myEmpId = req.user.employee?._id;

    for (const reqId of ids) {
      try {
        const approval = await ApprovalRequest.findById(reqId);
        if (!approval) {
          failed.push({ id: reqId, reason: 'Request record not found' });
          continue;
        }

        // 1. Self-approval block
        if (myEmpId && String(approval.requestedBy) === String(myEmpId)) {
          skipped.push({ id: reqId, title: approval.title, reason: 'Self-approval strictly forbidden' });
          continue;
        }

        // 2. Pending check
        if (approval.status !== 'pending') {
          skipped.push({ id: reqId, title: approval.title, reason: `Already ${approval.status}` });
          continue;
        }

        // 3. Step ownership check
        const stepIdx = approval.currentStep - 1;
        const currentStep = approval.steps[stepIdx];
        if (!currentStep || currentStep.status !== 'pending') {
          skipped.push({ id: reqId, title: approval.title, reason: 'No pending step active' });
          continue;
        }

        const isDirectApprover = myEmpId && String(currentStep.approverEmployee) === String(myEmpId);
        const isRoleApprover = currentStep.approverRole && (
          (isHR && currentStep.approverRole === 'hr') ||
          (isSuperAdmin && currentStep.approverRole === 'super_admin')
        );

        if (!isSuperAdmin && !isDirectApprover && !isRoleApprover) {
          skipped.push({ id: reqId, title: approval.title, reason: 'Current step does not belong to your scope' });
          continue;
        }

        // Execute action
        if (action === 'approve') {
          currentStep.status = 'approved';
          currentStep.actedBy = req.user._id;
          currentStep.actedAt = new Date();
          currentStep.comment = comment || 'Bulk approved';

          const isFinal = approval.currentStep >= approval.steps.length;
          if (isFinal) {
            approval.status = 'approved';
            await approval.save();
            const reg = approvalRegistry.get(approval.type);
            if (reg?.onApproved) await reg.onApproved(approval, req.user);
          } else {
            approval.currentStep += 1;
            await approval.save();
          }

          succeeded.push({ id: reqId, title: approval.title, status: approval.status });
        } else if (action === 'reject') {
          currentStep.status = 'rejected';
          currentStep.actedBy = req.user._id;
          currentStep.actedAt = new Date();
          currentStep.comment = comment;

          approval.status = 'rejected';
          await approval.save();

          const reg = approvalRegistry.get(approval.type);
          if (reg?.onRejected) await reg.onRejected(approval, req.user);

          succeeded.push({ id: reqId, title: approval.title, status: 'rejected' });
        }
      } catch (rowErr) {
        failed.push({ id: reqId, reason: rowErr.message });
      }
    }

    await logAudit({
      req,
      action: `BULK_${action.toUpperCase()}`,
      entity: 'ApprovalRequest',
      changes: {
        totalSelected: ids.length,
        succeededCount: succeeded.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        comment,
      },
    });

    return sendSuccess(
      res,
      {
        succeeded,
        skipped,
        failed,
        summary: {
          total: ids.length,
          succeeded: succeeded.length,
          skipped: skipped.length,
          failed: failed.length,
        },
      },
      `Bulk ${action} processed: ${succeeded.length} succeeded, ${skipped.length} skipped, ${failed.length} failed.`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 9. Delegations Management (GET, POST, DELETE)
 */
export const getDelegationsList = async (req, res, next) => {
  try {
    const userRole = req.userRole || (req.user?.role?.key || 'employee');
    const isSuperAdmin = userRole === 'super_admin';
    const isHR = userRole === 'hr';
    const myEmpId = req.user.employee?._id;

    let query = {};
    if (!isSuperAdmin && !isHR) {
      if (!myEmpId) return sendSuccess(res, [], 'No delegations');
      query.$or = [{ approver: myEmpId }, { delegate: myEmpId }];
    }

    const delegations = await Delegation.find(query)
      .populate('approver', 'personal.firstName personal.lastName employeeId')
      .populate('delegate', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 });

    return sendSuccess(res, delegations, 'Delegations retrieved');
  } catch (err) {
    next(err);
  }
};

export const createDelegationAction = async (req, res, next) => {
  try {
    const { approverId, delegateId, fromDate, toDate, types = ['all'], reason = '' } = req.body;
    const userRole = req.userRole || (req.user?.role?.key || 'employee');
    const isSuperAdmin = userRole === 'super_admin';
    const isHR = userRole === 'hr';
    const myEmpId = req.user.employee?._id;

    const targetApprover = (isSuperAdmin || isHR) && approverId ? approverId : myEmpId;
    if (!targetApprover) return sendError(res, 'Approver employee profile required', 400);

    if (String(targetApprover) === String(delegateId)) {
      return sendError(res, 'Cannot delegate approval power to yourself', 400);
    }

    const delegation = await Delegation.create({
      approver: targetApprover,
      delegate: delegateId,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      types: Array.isArray(types) ? types : [types],
      reason,
      isActive: true,
    });

    await logAudit({
      req,
      action: 'SET_DELEGATION',
      entity: 'Delegation',
      entityId: delegation._id,
      changes: { targetApprover, delegateId, fromDate, toDate, types },
    });

    return sendSuccess(res, delegation, 'Delegation configured successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteDelegationAction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const delegation = await Delegation.findById(id);
    if (!delegation) return sendError(res, 'Delegation not found', 404);

    delegation.isActive = false;
    await delegation.save();

    await logAudit({
      req,
      action: 'DEACTIVATE_DELEGATION',
      entity: 'Delegation',
      entityId: id,
    });

    return sendSuccess(res, delegation, 'Delegation deactivated');
  } catch (err) {
    next(err);
  }
};

/**
 * 10. GET Workflows Configuration per Type
 * GET /api/v1/approvals/workflows/:type
 * PUT /api/v1/approvals/workflows/:type
 */
export const getWorkflowConfig = async (req, res, next) => {
  try {
    const { type } = req.params;
    let config = await WorkflowConfig.findOne({ type });
    if (!config) {
      config = {
        type,
        steps: [
          { order: 1, approverRole: 'reporting_manager', title: 'Reporting Manager Review' },
          { order: 2, approverRole: 'hr', title: 'HR Administration' },
        ],
        conditions: { thresholdDaysForHR: 3 },
      };
    }
    return sendSuccess(res, config, 'Workflow configuration retrieved');
  } catch (err) {
    next(err);
  }
};

export const updateWorkflowConfig = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { steps = [], conditions = {} } = req.body;

    // Validate no empty steps
    if (!Array.isArray(steps) || steps.length === 0) {
      return sendError(res, 'Workflow must contain at least one valid step', 400);
    }

    let config = await WorkflowConfig.findOne({ type });
    if (!config) {
      config = new WorkflowConfig({ type, steps, conditions });
    } else {
      config.steps = steps;
      config.conditions = conditions;
    }
    await config.save();

    await logAudit({
      req,
      action: 'UPDATE_WORKFLOW_CONFIG',
      entity: 'WorkflowConfig',
      entityId: config._id,
      changes: { type, steps, conditions },
    });

    return sendSuccess(res, config, `Workflow settings updated for ${type}`);
  } catch (err) {
    next(err);
  }
};

/**
 * 11. GET CSV Export for Approvals
 * GET /api/v1/approvals/export
 */
export const exportApprovalsCsv = async (req, res, next) => {
  try {
    const requests = await ApprovalRequest.find()
      .populate('requestedBy', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 })
      .limit(1000);

    const headers = ['Request ID', 'Type', 'Title', 'Applicant Code', 'Applicant Name', 'Status', 'Urgency', 'Current Step', 'Created At'];
    const rows = requests.map((r) => [
      r._id,
      r.type,
      `"${(r.title || '').replace(/"/g, '""')}"`,
      r.requestedBy?.employeeId || '-',
      `"${r.requestedBy?.personal?.firstName || ''} ${r.requestedBy?.personal?.lastName || ''}"`,
      r.status,
      r.urgency || 'on_time',
      r.currentStep,
      new Date(r.createdAt).toISOString(),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="approvals_export.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
};
