import mongoose from 'mongoose';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { WorkflowConfig } from '../models/WorkflowConfig.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Department } from '../models/Department.js';
import { Delegation } from '../models/Delegation.js';
import { AuditLog } from '../models/AuditLog.js';
import { notifyUser } from './notification.service.js';
import { handleWorkflowCompletion } from './approvalHandlers.js';

/**
 * Resolves active delegation for an approver employee
 */
export const resolveDelegation = async (approverEmployeeId) => {
  if (!approverEmployeeId) return null;
  const now = new Date();
  const delegation = await Delegation.findOne({
    approver: approverEmployeeId,
    isActive: true,
    fromDate: { $lte: now },
    toDate: { $gte: now },
  });
  return delegation ? delegation.delegate : null;
};

/**
 * Resolves dynamic approver steps for any request
 * Step 1: Reporting Manager -> Dept Head -> HR
 * Step 2: HR
 * If requester is HR -> Route to Super Admin
 * If requester is Super Admin -> Route to another Super Admin; if sole, auto-approve
 */
export const resolveApproverSteps = async (requesterEmployeeId, requesterUserId, type) => {
  const requester = await Employee.findById(requesterEmployeeId)
    .populate('employment.reportingManager')
    .populate('employment.department');
  const requesterUser = requesterUserId ? await User.findById(requesterUserId).populate('role') : null;
  const requesterRoleKey = requesterUser?.role?.key || '';

  // Fetch all active super admins
  const superAdminUsers = await User.find({ isActive: true }).populate({
    path: 'role',
    match: { key: 'super_admin' },
  });
  const activeSuperAdmins = superAdminUsers.filter((u) => u.role);

  // Case 1: Requester is Super Admin
  if (requesterRoleKey === 'super_admin') {
    const otherSuperAdmins = activeSuperAdmins.filter(
      (u) => String(u._id) !== String(requesterUserId)
    );
    if (otherSuperAdmins.length === 0) {
      // Sole Super Admin -> Flag for auto-approval
      return { autoApprove: true, steps: [] };
    }
    // Route to another Super Admin
    const otherAdminEmp = otherSuperAdmins[0].employee || null;
    return {
      autoApprove: false,
      steps: [
        {
          order: 1,
          title: 'Peer Super Admin Review',
          approverRole: 'super_admin',
          approverEmployee: otherAdminEmp,
        },
      ],
    };
  }

  // Case 2: Requester is HR
  if (requesterRoleKey === 'hr') {
    return {
      autoApprove: false,
      steps: [
        {
          order: 1,
          title: 'Super Admin Approval',
          approverRole: 'super_admin',
          approverEmployee: activeSuperAdmins[0]?.employee || null,
        },
      ],
    };
  }

  // Case 3: Standard Employee or Manager
  let step1ApproverEmployee = null;
  let step1Role = '';
  let step1Title = 'Reporting Manager Approval';

  // 1a: Reporting Manager
  const managerId = requester?.employment?.reportingManager?._id;
  const mgrStatus = requester?.employment?.reportingManager?.status || requester?.employment?.reportingManager?.employment?.status;
  const managerActive = mgrStatus === 'active';

  if (managerId && managerActive && String(managerId) !== String(requesterEmployeeId)) {
    // Check delegation
    const delegated = await resolveDelegation(managerId);
    step1ApproverEmployee = delegated || managerId;
    if (delegated) step1Title += ' (Delegated)';
  } else {
    // 1b: Department Head
    let deptDoc = requester?.employment?.department;
    if (deptDoc && !deptDoc.head) {
      deptDoc = await Department.findById(deptDoc._id || deptDoc).populate('head');
    }

    const headId = deptDoc?.head?._id;
    if (headId && String(headId) !== String(requesterEmployeeId)) {
      const delegated = await resolveDelegation(headId);
      step1ApproverEmployee = delegated || headId;
      step1Title = 'Department Head Approval' + (delegated ? ' (Delegated)' : '');
    } else {
      // 1c: Fallback to HR
      step1Role = 'hr';
      step1Title = 'HR Review';
    }
  }

  const steps = [];
  if (step1ApproverEmployee) {
    steps.push({
      order: 1,
      title: step1Title,
      approverRole: '',
      approverEmployee: step1ApproverEmployee,
    });
    // Step 2 is HR
    steps.push({
      order: 2,
      title: 'HR Verification',
      approverRole: 'hr',
      approverEmployee: null,
    });
  } else {
    // Step 1 directly HR (single step)
    steps.push({
      order: 1,
      title: 'HR Administration Approval',
      approverRole: 'hr',
      approverEmployee: null,
    });
  }

  return { autoApprove: false, steps };
};

/**
 * Creates an ApprovalRequest with strict routing & sole Super Admin auto-approval
 */
export const createApprovalRequest = async ({
  type,
  referenceModel,
  referenceId,
  requestedByEmployeeId,
  requesterUserId,
  title,
  metadata = {},
  isDemo = false,
}) => {
  const requester = await Employee.findById(requestedByEmployeeId);
  const requesterUser = requesterUserId ? await User.findById(requesterUserId) : null;

  const { autoApprove, steps } = await resolveApproverSteps(
    requestedByEmployeeId,
    requesterUserId,
    type
  );

  if (autoApprove) {
    // Sole Super Admin auto-approve with explicit audit log and HR notification
    const autoStep = {
      order: 1,
      title: 'Super Admin Direct Approval',
      approverRole: 'super_admin',
      approverEmployee: requestedByEmployeeId,
      status: 'approved',
      actedBy: requesterUserId,
      actedAt: new Date(),
      comment: 'Self-approved by Super Admin (sole executive)',
    };

    const approval = await ApprovalRequest.create({
      type,
      referenceModel,
      referenceId,
      requestedBy: requestedByEmployeeId,
      title,
      metadata: { ...metadata, autoApproved: true, approverNote: 'Sole executive Super Admin' },
      steps: [autoStep],
      currentStep: 1,
      status: 'approved',
      isDemo,
    });

    // Record in AuditLog
    await AuditLog.create({
      user: requesterUserId,
      userEmail: requesterUser?.email || 'admin@illusory.design',
      action: 'AUTO_APPROVE',
      entity: 'ApprovalRequest',
      entityId: approval._id,
      changes: {
        type,
        referenceModel,
        referenceId,
        reason: 'Self-approved by Super Admin (sole executive)',
      },
    });

    // Execute lifecycle completion immediately
    await handleWorkflowCompletion(approval, 'approved', requesterUser);

    // Notify HR users for visibility
    const hrUsers = await User.find({ isActive: true }).populate({
      path: 'role',
      match: { key: { $in: ['hr', 'admin'] } },
    });
    for (const hr of hrUsers.filter((u) => u.role)) {
      await notifyUser({
        userId: hr._id,
        title: `Auto-Approved: ${approval.title}`,
        message: `${requester?.personal?.firstName || 'Super Admin'} submitted and auto-approved ${type} request.`,
        link: '/hrms/attendance',
        type: 'approval',
      });
    }

    return approval;
  }

  // Normal approval creation
  const approval = await ApprovalRequest.create({
    type,
    referenceModel,
    referenceId,
    requestedBy: requestedByEmployeeId,
    title,
    metadata,
    steps,
    currentStep: 1,
    status: 'pending',
    isDemo,
  });

  // Notify initial approvers
  await notifyFirstApprover(approval, requester);

  return approval;
};

/**
 * Notifies initial approvers
 */
export const notifyFirstApprover = async (approval, requester) => {
  const firstStep = approval.steps[0];
  const requesterName = `${requester?.personal?.firstName || ''} ${requester?.personal?.lastName || ''}`.trim() || 'An employee';

  if (firstStep?.approverEmployee) {
    const approverUser = await User.findOne({ employee: firstStep.approverEmployee });
    if (approverUser) {
      await notifyUser({
        userId: approverUser._id,
        title: `Pending Approval: ${approval.title}`,
        message: `${requesterName} submitted a ${approval.type} request requiring your review.`,
        link: '/hrms/attendance',
        type: 'approval',
      });
    }
  } else if (firstStep?.approverRole) {
    const users = await User.find({ isActive: true }).populate({
      path: 'role',
      match: { key: { $in: [firstStep.approverRole, 'super_admin'] } },
    });
    for (const u of users.filter((u) => u.role)) {
      await notifyUser({
        userId: u._id,
        title: `Pending Approval: ${approval.title}`,
        message: `${requesterName} submitted a ${approval.type} request requiring your review.`,
        link: '/hrms/attendance',
        type: 'approval',
      });
    }
  }
};

/**
 * Reassigns an approval step to another employee or role
 */
export const reassignApprovalStep = async ({
  approvalId,
  targetEmployeeId = null,
  targetRole = '',
  comment = '',
  actedByUser,
}) => {
  const approval = await ApprovalRequest.findById(approvalId);
  if (!approval) throw new Error('Approval request not found');
  if (approval.status !== 'pending') throw new Error(`Cannot reassign ${approval.status} request`);

  const stepIndex = approval.currentStep - 1;
  const step = approval.steps[stepIndex];
  if (!step) throw new Error('Invalid step for reassignment');

  const oldAssignee = step.approverEmployee
    ? `Employee ${step.approverEmployee}`
    : `Role ${step.approverRole}`;

  if (targetEmployeeId) {
    step.approverEmployee = targetEmployeeId;
    step.approverRole = '';
  } else if (targetRole) {
    step.approverRole = targetRole;
    step.approverEmployee = null;
  } else {
    throw new Error('Either targetEmployeeId or targetRole must be specified');
  }

  step.comment = comment ? `Reassigned: ${comment}` : 'Reassigned by HR/Admin';
  await approval.save();

  // Audit log
  await AuditLog.create({
    user: actedByUser._id,
    userEmail: actedByUser.email,
    action: 'REASSIGN_APPROVER',
    entity: 'ApprovalRequest',
    entityId: approval._id,
    changes: {
      oldAssignee,
      newAssignee: targetEmployeeId || targetRole,
      comment,
      step: approval.currentStep,
    },
  });

  return approval;
};
