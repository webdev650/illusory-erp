import mongoose from 'mongoose';
import { handleWorkflowCompletion } from './approvalHandlers.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { AttendanceRegularization } from '../models/AttendanceRegularization.js';
import { RemoteWorkRequest } from '../models/RemoteWorkRequest.js';
import { PartialDayRequest } from '../models/PartialDayRequest.js';
import { CompOffRequest } from '../models/CompOffRequest.js';
import Timesheet from '../models/Timesheet.js';
import AssetRequest from '../models/AssetRequest.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveType } from '../models/LeaveType.js';

/**
 * Universal Approval Type Registry
 * Allows any current or future module (expense, travel, salary revision, offer letter)
 * to plug in without modifying the frontend page or core engine.
 */
class ApprovalTypeRegistry {
  constructor() {
    this.types = new Map();
  }

  /**
   * Register a new approval type
   */
  register(key, config) {
    if (!key || typeof key !== 'string') {
      throw new Error('ApprovalType key must be a valid non-empty string');
    }
    this.types.set(key, {
      key,
      label: config.label || key,
      icon: config.icon || 'FileText',
      colour: config.colour || 'slate',
      module: config.module || 'HRMS',
      permission: config.permission || 'approval.act',
      defaultSlaHours: config.defaultSlaHours || 48,
      referenceModel: config.referenceModel,
      renderSummary: config.renderSummary || ((data) => data?.title || key),
      fetchDetails: config.fetchDetails || (async (referenceId) => ({ id: referenceId })),
      onApproved: config.onApproved || (async (approval, user) => handleWorkflowCompletion(approval, 'approved', user)),
      onRejected: config.onRejected || (async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user)),
      onCancelled: config.onCancelled || (async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user)),
      onReturned: config.onReturned || (async (approval, user, comment) => {
        // Default return handler: mark underlying request as returned/draft
        if (config.referenceModel && approval.referenceId) {
          const Model = mongoose.model(config.referenceModel);
          if (Model) {
            await Model.findByIdAndUpdate(approval.referenceId, { status: 'returned', returnComment: comment });
          }
        }
      }),
    });
  }

  get(key) {
    return this.types.get(key) || null;
  }

  has(key) {
    return this.types.has(key);
  }

  getAll() {
    return Array.from(this.types.values());
  }
}

export const approvalRegistry = new ApprovalTypeRegistry();

// 1. LEAVE APPROVAL
approvalRegistry.register('leave', {
  label: 'Leave Request',
  icon: 'Calendar',
  colour: 'violet',
  module: 'Attendance & Leaves',
  permission: 'approval.act',
  defaultSlaHours: 48,
  referenceModel: 'LeaveRequest',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    const days = meta.days || req.days || 1;
    const typeName = meta.leaveTypeName || 'Leave';
    const dates = meta.dates || (req.fromDate ? `${new Date(req.fromDate).toLocaleDateString()} - ${new Date(req.toDate).toLocaleDateString()}` : '');
    return `${typeName}, ${days} day${days > 1 ? 's' : ''}${dates ? `, ${dates}` : ''}`;
  },
  fetchDetails: async (referenceId) => {
    const leave = await LeaveRequest.findById(referenceId)
      .populate('leaveType')
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation employment.department');
    if (!leave) return null;

    const currentYear = new Date(leave.fromDate).getFullYear();
    const balance = await LeaveBalance.findOne({
      employee: leave.employee?._id,
      leaveType: leave.leaveType?._id,
      year: currentYear,
    });

    return {
      type: 'leave',
      leaveRequest: leave,
      balanceBefore: balance ? {
        allocated: balance.allocated,
        used: balance.used,
        pending: balance.pending,
        closingDays: balance.closingDays || (balance.closingMinutes ? balance.closingMinutes / 465 : 0),
      } : null,
      balanceAfterClosingEstimate: balance ? Math.max(0, (balance.closingDays || 0) - leave.days) : 0,
      daysBreakdown: (leave.dates || []).map((d) => ({
        date: d.date,
        dayPortion: d.dayPortion || (d.isHalfDay ? 'half' : 'full'),
      })),
      reason: leave.reason,
      contactDetails: leave.contactDetails || '',
    };
  },
  onApproved: async (approval, user) => handleWorkflowCompletion(approval, 'approved', user),
  onRejected: async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user),
  onCancelled: async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user),
  onReturned: async (approval, user, comment) => {
    await LeaveRequest.findByIdAndUpdate(approval.referenceId, {
      status: 'returned',
      remarks: comment,
    });
  },
});

// 2. LOG REGULARIZATION
approvalRegistry.register('regularization', {
  label: 'Log Regularization',
  icon: 'Clock',
  colour: 'amber',
  module: 'Attendance & Logs',
  permission: 'approval.act',
  defaultSlaHours: 48,
  referenceModel: 'AttendanceRegularization',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    const dateStr = meta.date ? new Date(meta.date).toLocaleDateString() : '';
    const reqType = meta.regularizationType || 'Missing Punch';
    return `${reqType} on ${dateStr}: ${meta.requestedTime || 'Punch correction'}`;
  },
  fetchDetails: async (referenceId) => {
    const reg = await AttendanceRegularization.findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId');
    return {
      type: 'regularization',
      record: reg,
      targetDate: reg?.date,
      existingPunches: reg?.existingPunches || [],
      requestedPunch: reg?.requestedPunch,
      reason: reg?.reason,
    };
  },
  onApproved: async (approval, user) => handleWorkflowCompletion(approval, 'approved', user),
  onRejected: async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user),
  onCancelled: async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user),
});

// 3. REMOTE WORK
approvalRegistry.register('remote_work', {
  label: 'Remote Work',
  icon: 'Laptop',
  colour: 'sky',
  module: 'Attendance & Leaves',
  permission: 'approval.act',
  defaultSlaHours: 48,
  referenceModel: 'RemoteWorkRequest',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `Remote Work: ${meta.days || 1} day(s) (${meta.dates || 'Scheduled'})`;
  },
  fetchDetails: async (referenceId) => {
    const r = await RemoteWorkRequest.findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId');
    return {
      type: 'remote_work',
      record: r,
      fromDate: r?.fromDate,
      toDate: r?.toDate,
      reason: r?.reason,
    };
  },
  onApproved: async (approval, user) => handleWorkflowCompletion(approval, 'approved', user),
  onRejected: async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user),
  onCancelled: async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user),
});

// 4. PARTIAL DAY
approvalRegistry.register('partial_day', {
  label: 'Partial Day',
  icon: 'Timer',
  colour: 'teal',
  module: 'Attendance & Leaves',
  permission: 'approval.act',
  defaultSlaHours: 24,
  referenceModel: 'PartialDayRequest',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `Partial Day (${meta.minutes || 60}m) on ${meta.date ? new Date(meta.date).toLocaleDateString() : ''}`;
  },
  fetchDetails: async (referenceId) => {
    const p = await PartialDayRequest.findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId');
    return {
      type: 'partial_day',
      record: p,
      date: p?.date,
      minutes: p?.minutes,
      reason: p?.reason,
    };
  },
  onApproved: async (approval, user) => handleWorkflowCompletion(approval, 'approved', user),
  onRejected: async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user),
  onCancelled: async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user),
});

// 5. COMP-OFF REQUEST
approvalRegistry.register('comp_off', {
  label: 'Comp-Off Credit',
  icon: 'Award',
  colour: 'emerald',
  module: 'Attendance & Leaves',
  permission: 'approval.act',
  defaultSlaHours: 48,
  referenceModel: 'CompOffRequest',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `Comp-Off Credit claim for worked weekend/holiday: ${meta.workDate ? new Date(meta.workDate).toLocaleDateString() : ''}`;
  },
  fetchDetails: async (referenceId) => {
    const c = await CompOffRequest.findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId');
    return {
      type: 'comp_off',
      record: c,
      workDate: c?.workDate,
      presenceVerified: c?.isPresenceVerified,
      hoursWorked: c?.hoursWorked || 7.75,
      reason: c?.reason,
    };
  },
  onApproved: async (approval, user) => handleWorkflowCompletion(approval, 'approved', user),
  onRejected: async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user),
  onCancelled: async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user),
});

// 6. TIMESHEET
approvalRegistry.register('timesheet', {
  label: 'Timesheet Submission',
  icon: 'FileSpreadsheet',
  colour: 'indigo',
  module: 'Project Operations',
  permission: 'approval.act',
  defaultSlaHours: 72,
  referenceModel: 'Timesheet',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `Weekly Timesheet (${meta.totalHours || 0} hrs): ${meta.period || 'Week Period'}`;
  },
  fetchDetails: async (referenceId) => {
    const t = await Timesheet.findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId');
    return {
      type: 'timesheet',
      record: t,
      period: t?.period,
      totalHours: t?.totalHours,
      entries: t?.entries || [],
    };
  },
  onApproved: async (approval, user) => handleWorkflowCompletion(approval, 'approved', user),
  onRejected: async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user),
  onCancelled: async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user),
});

// 7. ASSET REQUEST
approvalRegistry.register('asset_request', {
  label: 'Hardware & License Request',
  icon: 'Shield',
  colour: 'purple',
  module: 'Assets & Custody',
  permission: 'approval.act',
  defaultSlaHours: 48,
  referenceModel: 'AssetRequest',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `Asset Request: ${meta.assetCategory || 'Hardware'} - ${meta.itemRequested || req.title}`;
  },
  fetchDetails: async (referenceId) => {
    const a = await AssetRequest.findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId');
    return {
      type: 'asset_request',
      record: a,
      category: a?.category,
      urgency: a?.urgency,
      reason: a?.reason,
    };
  },
  onApproved: async (approval, user) => handleWorkflowCompletion(approval, 'approved', user),
  onRejected: async (approval, user) => handleWorkflowCompletion(approval, 'rejected', user),
  onCancelled: async (approval, user) => handleWorkflowCompletion(approval, 'cancelled', user),
});

// 8. PROFILE CHANGE REQUEST (Self-Service)
approvalRegistry.register('profile_change', {
  label: 'Profile Modification Request',
  icon: 'UserCheck',
  colour: 'emerald',
  module: 'Core HR',
  permission: 'profile.approveChange',
  defaultSlaHours: 48,
  referenceModel: 'Employee',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `Profile Update: ${meta.fieldName || 'Official Details'} modification`;
  },
  fetchDetails: async (referenceId) => {
    const emp = await Employee.findById(referenceId);
    return {
      type: 'profile_change',
      employee: emp,
    };
  },
  onApproved: async (approval, user) => {
    // Apply requested changes to the employee document
    const emp = await Employee.findById(approval.referenceId);
    if (!emp) return;
    const updates = approval.metadata?.updates || {};
    Object.keys(updates).forEach((k) => {
      const parts = k.split('.');
      if (parts.length === 2) {
        if (!emp[parts[0]]) emp[parts[0]] = {};
        emp[parts[0]][parts[1]] = updates[k];
      } else {
        emp[k] = updates[k];
      }
    });
    emp.history.push({
      date: new Date(),
      type: 'PROFILE_CHANGE_APPROVED',
      from: 'Self-Service Request',
      to: 'Approved by HR',
      remarks: approval.title,
    });
    await emp.save();
  },
  onRejected: async (approval, user) => {
    // Notification handled by core engine
  },
  onCancelled: async (approval, user) => {},
});

// 9. LETTER ISSUANCE APPROVAL
approvalRegistry.register('letter', {
  label: 'Official Letter Issuance',
  icon: 'FileText',
  colour: 'indigo',
  module: 'Letters & Documentation',
  permission: 'letter.approve',
  defaultSlaHours: 48,
  referenceModel: 'IssuedLetter',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `${meta.categoryLabel || 'Official Document'}: ${req.title} (Ref: ${meta.refNo || 'Pending'})`;
  },
  fetchDetails: async (referenceId) => {
    const letter = await mongoose.model('IssuedLetter').findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('template', 'name category');
    return {
      type: 'letter',
      letter,
      renderedPreview: letter?.renderedBody,
      refNo: letter?.refNo,
    };
  },
  onApproved: async (approval, user) => {
    const letter = await mongoose.model('IssuedLetter').findById(approval.referenceId);
    if (letter) {
      letter.status = 'issued';
      letter.issuedAt = new Date();
      letter.issuedBy = user?._id || user?.id || null;
      await letter.save();
      return letter;
    }
  },
  onRejected: async (approval, user) => {
    const letter = await mongoose.model('IssuedLetter').findById(approval.referenceId);
    if (letter) {
      letter.status = 'revoked';
      letter.revocationReason = 'Rejected in approval workflow';
      await letter.save();
    }
  },
  onCancelled: async (approval, user) => {},
});

// 10. GOAL REQUISITION APPROVAL
approvalRegistry.register('goal', {
  label: 'OKR Goal Approval',
  icon: 'Target',
  colour: 'emerald',
  module: 'Performance',
  permission: 'performance.goal.approve',
  defaultSlaHours: 72,
  referenceModel: 'Goal',
  renderSummary: (req) => {
    const meta = req.metadata || {};
    return `Goal: "${meta.title || req.title}" (${meta.keyResultCount || 0} Key Results, Weight ${meta.weight || 1})`;
  },
  fetchDetails: async (referenceId) => {
    const goal = await mongoose.model('Goal').findById(referenceId)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('linkedProjects', 'name code');
    return {
      type: 'goal',
      goal,
      title: goal?.title,
      description: goal?.description,
      keyResults: goal?.keyResults,
      dueDate: goal?.dueDate,
    };
  },
  onApproved: async (approval, user) => {
    const goal = await mongoose.model('Goal').findById(approval.referenceId);
    if (goal) {
      goal.status = 'active';
      await goal.save();
      return goal;
    }
  },
  onRejected: async (approval, user) => {
    const goal = await mongoose.model('Goal').findById(approval.referenceId);
    if (goal) {
      goal.status = 'draft';
      await goal.save();
    }
  },
  onCancelled: async (approval, user) => {
    const goal = await mongoose.model('Goal').findById(approval.referenceId);
    if (goal) {
      goal.status = 'cancelled';
      await goal.save();
    }
  },
});
