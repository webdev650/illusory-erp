import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { WorkflowConfig } from '../models/WorkflowConfig.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { notifyUser } from './notification.service.js';

/**
 * Creates an ApprovalRequest using the defined WorkflowConfig (or dynamic fallback)
 */
export const createApprovalRequest = async ({
  type,
  referenceModel,
  referenceId,
  requestedByEmployeeId,
  title,
  metadata = {},
}) => {
  const requester = await Employee.findById(requestedByEmployeeId).populate('employment.reportingManager');

  // Find workflow configuration
  let config = await WorkflowConfig.findOne({ type, isActive: true });

  const steps = [];

  if (config && config.steps?.length > 0) {
    for (const s of config.steps) {
      if (s.approverType === 'manager') {
        const managerId = requester?.employment?.reportingManager?._id;
        if (managerId && String(managerId) !== String(requester._id)) {
          steps.push({
            order: s.order,
            title: s.name || 'Manager Review',
            approverRole: '',
            approverEmployee: managerId,
          });
        } else {
          // If no manager or self, fallback to HR
          steps.push({
            order: s.order,
            title: 'HR Review',
            approverRole: 'hr',
            approverEmployee: null,
          });
        }
      } else if (s.approverType === 'role') {
        steps.push({
          order: s.order,
          title: s.name || `${s.roleKey.toUpperCase()} Review`,
          approverRole: s.roleKey,
          approverEmployee: null,
        });
      } else if (s.approverType === 'employee') {
        steps.push({
          order: s.order,
          title: s.name || 'Designated Approver',
          approverRole: '',
          approverEmployee: s.specificEmployee,
        });
      }
    }
  } else {
    // Default 2-step flow: 1. Manager (or HR), 2. HR
    const managerId = requester?.employment?.reportingManager?._id;
    if (managerId && String(managerId) !== String(requester._id)) {
      steps.push({
        order: 1,
        title: 'Reporting Manager Approval',
        approverRole: '',
        approverEmployee: managerId,
      });
      steps.push({
        order: 2,
        title: 'HR Verification',
        approverRole: 'hr',
        approverEmployee: null,
      });
    } else {
      steps.push({
        order: 1,
        title: 'HR Administration Approval',
        approverRole: 'hr',
        approverEmployee: null,
      });
    }
  }

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
  });

  // Notify first approver
  await notifyFirstApprover(approval, requester);

  return approval;
};

/**
 * Notifies the initial approver(s) of a newly raised request
 */
const notifyFirstApprover = async (approval, requester) => {
  const firstStep = approval.steps[0];
  const requesterName = `${requester?.personal?.firstName || ''} ${requester?.personal?.lastName || ''}`.trim() || 'An employee';

  if (firstStep?.approverEmployee) {
    const approverUser = await User.findOne({ employee: firstStep.approverEmployee });
    if (approverUser) {
      await notifyUser({
        userId: approverUser._id,
        title: `Pending Approval: ${approval.title}`,
        message: `${requesterName} submitted a ${approval.type} request requiring your review.`,
        link: '/hr?tab=approvals',
        type: 'approval',
      });
    }
  } else if (firstStep?.approverRole) {
    // Notify all users holding that role
    const users = await User.find({ isActive: true }).populate({
      path: 'role',
      match: { key: { $in: [firstStep.approverRole, 'super_admin'] } },
    });
    for (const u of users) {
      if (u.role) {
        await notifyUser({
          userId: u._id,
          title: `New ${approval.type.toUpperCase()} Approval Request`,
          message: `${requesterName} has submitted a request: "${approval.title}".`,
          link: '/hr?tab=approvals',
          type: 'approval',
        });
      }
    }
  }
};
