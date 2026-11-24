import mongoose from 'mongoose';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { Delegation } from '../models/Delegation.js';
import { Holiday } from '../models/Holiday.js';
import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { AuditLog } from '../models/AuditLog.js';
import { notifyUser } from './notification.service.js';
import { approvalRegistry } from './approvalRegistry.js';

/**
 * Calculates business hours SLA due date, pausing on Sundays and company holidays
 */
export const calculateSlaDueDate = async (startDate, slaHours = 48, pauseOnWeekends = true) => {
  let currentDate = new Date(startDate);
  let remainingHours = slaHours;

  const holidays = await Holiday.find({
    date: { $gte: new Date(startDate.getTime() - 86400000) },
  });
  const holidayDates = new Set(
    holidays.map((h) => new Date(h.date).toISOString().split('T')[0])
  );

  while (remainingHours > 0) {
    currentDate = new Date(currentDate.getTime() + 3600000); // add 1 hour
    const dateStr = currentDate.toISOString().split('T')[0];
    const isSunday = currentDate.getUTCDay() === 0;

    if (pauseOnWeekends && (isSunday || holidayDates.has(dateStr))) {
      // Pause clock during Sunday or recognized company holiday
      continue;
    }
    remainingHours--;
  }

  return currentDate;
};

/**
 * Evaluates urgency status (on_time, due_soon, overdue)
 */
export const evaluateUrgency = (dueDate) => {
  if (!dueDate) return 'on_time';
  const now = new Date();
  const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) return 'overdue';
  if (diffHours <= 12) return 'due_soon'; // 12 hours left
  return 'on_time';
};

/**
 * Check if employee is currently on approved leave (Out of Office)
 */
export const isApproverOutOfOffice = async (employeeId) => {
  if (!employeeId) return false;
  const now = new Date();
  const activeLeave = await LeaveRequest.findOne({
    employee: employeeId,
    status: 'approved',
    fromDate: { $lte: now },
    toDate: { $gte: now },
  });
  return Boolean(activeLeave);
};

/**
 * Hourly Cron Evaluator: Check SLA, mark overdue, trigger reminders, and auto-escalate
 */
export const runSlaAndEscalationCheck = async () => {
  const pendingRequests = await ApprovalRequest.find({ status: 'pending' })
    .populate('steps.approverEmployee')
    .populate('requestedBy');

  const now = new Date();
  let updatedCount = 0;
  let escalatedCount = 0;

  for (const req of pendingRequests) {
    const currentStep = req.steps[req.currentStep - 1];
    if (!currentStep || currentStep.status !== 'pending') continue;

    // Recalculate urgency
    const newUrgency = evaluateUrgency(req.dueDate);
    let isDirty = false;

    if (req.urgency !== newUrgency) {
      req.urgency = newUrgency;
      isDirty = true;
    }

    // Auto-escalate if overdue by > 24 hours past due date
    const overdueHours = req.dueDate ? (now.getTime() - req.dueDate.getTime()) / 3600000 : 0;
    if (overdueHours > 24 && !req.metadata?.escalated) {
      if (!req.metadata) req.metadata = {};
      req.metadata.escalated = true;
      req.metadata.escalatedAt = now;

      req.timeline.push({
        action: 'ESCALATED',
        comment: `Automated SLA Escalation: Pending for over ${Math.round(overdueHours)} hours past SLA threshold.`,
        timestamp: now,
      });

      // Notify Super Admin and HR
      const adminUsers = await User.find({ isActive: true }).populate({
        path: 'role',
        match: { key: { $in: ['super_admin', 'hr'] } },
      });
      for (const admin of adminUsers.filter((u) => u.role)) {
        await notifyUser(admin._id, {
          title: `[ESCALATED] Overdue Approval: ${req.title}`,
          message: `Request by ${req.requestedBy?.personal?.firstName || 'Staff'} has exceeded SLA threshold.`,
          type: 'approval_escalation',
          link: `/hrms/approvals?id=${req._id}`,
        });
      }

      escalatedCount++;
      isDirty = true;
    }

    if (isDirty) {
      await req.save();
      updatedCount++;
    }
  }

  return { evaluated: pendingRequests.length, updatedCount, escalatedCount };
};

/**
 * Get Employee Context Card details for Approval Drawer:
 * - Designation, Department, Manager, Current Status
 * - Leave Balances
 * - Last 5 similar requests
 * - Month Late Count
 * - Team absence clashes for requested dates
 */
export const getApprovalEmployeeContext = async (approvalId) => {
  const approval = await ApprovalRequest.findById(approvalId)
    .populate('requestedBy')
    .populate('steps.approverEmployee', 'personal.firstName personal.lastName employeeId')
    .populate('steps.actedBy', 'email');

  if (!approval) throw new Error('Approval request not found');

  const employee = await Employee.findById(approval.requestedBy._id)
    .populate('employment.department')
    .populate('employment.reportingManager');

  const deptId = employee.employment?.department?._id;
  const currentYear = new Date().getFullYear();

  // 1. Leave Balances
  const balances = await LeaveBalance.find({
    employee: employee._id,
    year: currentYear,
  }).populate('leaveType');

  // 2. Last 5 similar requests by this employee
  const recentRequests = await ApprovalRequest.find({
    requestedBy: employee._id,
    type: approval.type,
    _id: { $ne: approval._id },
  })
    .sort({ createdAt: -1 })
    .limit(5);

  // 3. Late count this month
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const lateAttendance = await mongoose.model('Attendance').countDocuments({
    employee: employee._id,
    date: { $gte: startOfMonth },
    isLate: true,
  });

  // 4. Team absence clashes (colleagues in same dept on leave during same dates)
  let clashes = [];
  const targetDates = approval.metadata?.datesArray || (approval.metadata?.fromDate && approval.metadata?.toDate ? [approval.metadata.fromDate, approval.metadata.toDate] : []);
  if (deptId && targetDates.length > 0) {
    const colleagues = await Employee.find({
      'employment.department': deptId,
      _id: { $ne: employee._id },
      isDeleted: false,
    });
    const colleagueIds = colleagues.map((c) => c._id);

    const overlappingLeaves = await LeaveRequest.find({
      employee: { $in: colleagueIds },
      status: 'approved',
      fromDate: { $lte: new Date(targetDates[targetDates.length - 1]) },
      toDate: { $gte: new Date(targetDates[0]) },
    }).populate('employee', 'personal.firstName personal.lastName employeeId');

    clashes = overlappingLeaves.map((l) => ({
      employeeName: `${l.employee?.personal?.firstName} ${l.employee?.personal?.lastName}`,
      employeeCode: l.employee?.employeeId,
      fromDate: l.fromDate,
      toDate: l.toDate,
      days: l.days,
    }));
  }

  // 5. Check if current step approver is Out of Office
  const currentStep = approval.steps[approval.currentStep - 1];
  let isCurrentApproverOOO = false;
  if (currentStep?.approverEmployee) {
    isCurrentApproverOOO = await isApproverOutOfOffice(currentStep.approverEmployee._id || currentStep.approverEmployee);
  }

  return {
    employee: {
      id: employee._id,
      code: employee.employeeId,
      name: `${employee.personal?.firstName} ${employee.personal?.lastName}`,
      designation: employee.employment?.designation || 'Staff',
      department: employee.employment?.department?.name || 'General',
      manager: employee.employment?.reportingManager
        ? `${employee.employment.reportingManager.personal?.firstName} ${employee.employment.reportingManager.personal?.lastName}`
        : 'None (Direct to Studio Management)',
      status: employee.status,
    },
    balances: balances.map((b) => ({
      leaveTypeCode: b.leaveType?.code,
      leaveTypeName: b.leaveType?.name,
      allocated: b.allocated,
      used: b.used,
      pending: b.pending,
      closingDays: b.closingDays || (b.closingMinutes ? parseFloat((b.closingMinutes / 465).toFixed(2)) : 0),
    })),
    recentRequests: recentRequests.map((r) => ({
      id: r._id,
      title: r.title,
      status: r.status,
      createdAt: r.createdAt,
    })),
    monthLateCount: lateAttendance,
    clashes,
    clashWarning: clashes.length >= 2, // warning if 2 or more team members away simultaneously
    isCurrentApproverOOO,
  };
};
