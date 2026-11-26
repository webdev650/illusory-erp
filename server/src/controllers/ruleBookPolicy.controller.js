import mongoose from 'mongoose';
import { AttendancePolicy, DEFAULT_UNVERIFIED_SETTINGS } from '../models/AttendancePolicy.js';
import { LatePenaltyRecord } from '../models/LatePenaltyRecord.js';
import { CriticalDate } from '../models/CriticalDate.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { Employee } from '../models/Employee.js';
import { getCompanyPolicy } from '../services/dayStatus.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

/**
 * 1. GET /api/v1/attendance/policy/confirmations
 * Get all Rule Book Section 12 policy items and their verification status
 */
export const getPolicyConfirmations = async (req, res, next) => {
  try {
    const policy = await getCompanyPolicy();
    let unverifiedList = policy.unverifiedSettings || [];

    // Ensure all default unverified settings exist in the list
    if (!unverifiedList || unverifiedList.length === 0) {
      policy.unverifiedSettings = DEFAULT_UNVERIFIED_SETTINGS;
      await policy.save();
      unverifiedList = policy.unverifiedSettings;
    }

    return sendSuccess(res, {
      policy: {
        id: policy._id,
        name: policy.name,
        lateAfterTime: policy.lateAfterTime,
        graceMinutes: policy.graceMinutes,
        latePenaltyMode: policy.latePenaltyMode,
        maxRegularizationsPerMonth: policy.maxRegularizationsPerMonth,
        accrualStartRule: policy.accrualStartRule,
        accrueDuringProbation: policy.accrueDuringProbation,
        minServiceMonths: policy.minServiceMonths,
        minServiceFrom: policy.minServiceFrom,
        partialDayEnabled: policy.partialDayEnabled,
        sandwichMode: policy.sandwichMode,
        breakPunchingMandatory: policy.breakPunchingMandatory,
        annualLeaveMaxCarryDays: policy.annualLeaveMaxCarryDays,
        casualLeaveForwardMode: policy.casualLeaveForwardMode,
        attendanceSource: policy.attendanceSource,
      },
      items: unverifiedList,
    }, 'Rule Book policy verification checklist retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 2. POST /api/v1/attendance/policy/confirmations/:key
 * HR/Admin confirms or marks an unverified Rule Book policy setting
 */
export const confirmPolicyItem = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { isConfirmed, notes } = req.body;

    const policy = await getCompanyPolicy();
    const item = policy.unverifiedSettings.find((s) => s.key === key);

    if (!item) {
      return sendError(res, `Policy confirmation item [${key}] not found`, 404);
    }

    item.isConfirmed = !!isConfirmed;
    item.confirmedBy = req.user._id;
    item.confirmedAt = new Date();
    if (notes !== undefined) item.notes = notes;

    await policy.save();

    await logAudit({
      req,
      action: isConfirmed ? 'CONFIRM_POLICY_SETTING' : 'UNCONFIRM_POLICY_SETTING',
      entity: 'AttendancePolicy',
      entityId: policy._id,
      changes: { key, isConfirmed, confirmedBy: req.user.email },
    });

    return sendSuccess(res, item, `Policy setting [${item.label}] status updated`);
  } catch (err) {
    next(err);
  }
};

/**
 * 3. GET /api/v1/attendance/late-penalties
 * List LatePenaltyRecords with filters
 */
export const getLatePenalties = async (req, res, next) => {
  try {
    const { status, month, year, employeeId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (month) filter.month = parseInt(month, 10);
    if (year) filter.year = parseInt(year, 10);
    if (employeeId) filter.employee = employeeId;

    const penalties = await LatePenaltyRecord.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('reviewedBy', 'personal.firstName personal.lastName email')
      .sort({ date: -1 });

    return sendSuccess(res, penalties, 'Late penalty records retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 4. POST /api/v1/attendance/late-penalties/:id/action
 * HR approves, waives, or modifies a late penalty with mandatory reason
 */
export const actOnLatePenalty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason, modifiedTier } = req.body;

    if (!action || !['approve', 'waive', 'modify'].includes(action)) {
      return sendError(res, 'Action must be approve, waive, or modify', 400);
    }

    if (!reason || !reason.trim()) {
      return sendError(res, 'A justification reason is mandatory for any HR penalty action', 400);
    }

    const penalty = await LatePenaltyRecord.findById(id).populate('employee');
    if (!penalty) return sendError(res, 'Penalty record not found', 404);

    const oldStatus = penalty.status;
    const oldTier = penalty.deductionTier;

    if (action === 'approve') {
      penalty.status = 'approved';
    } else if (action === 'waive') {
      penalty.status = 'waived';
      penalty.isExcused = true;
      penalty.excuseType = 'hr_waiver';
    } else if (action === 'modify') {
      if (!modifiedTier || !['none', 'half_day', 'full_day'].includes(modifiedTier)) {
        return sendError(res, 'Modified tier must be none, half_day, or full_day', 400);
      }
      penalty.status = 'modified';
      penalty.deductionTier = modifiedTier;
    }

    penalty.reviewedBy = req.user._id;
    penalty.reviewedAt = new Date();
    penalty.reviewReason = reason;

    penalty.auditHistory.push({
      action: `HR_${action.toUpperCase()}`,
      performedBy: req.user._id,
      performedAt: new Date(),
      reason,
      details: { previousStatus: oldStatus, previousTier: oldTier, newStatus: penalty.status, newTier: penalty.deductionTier },
    });

    await penalty.save();

    await logAudit({
      req,
      action: `PENALTY_${action.toUpperCase()}`,
      entity: 'LatePenaltyRecord',
      entityId: penalty._id,
      changes: { action, reason, employee: penalty.employee?.employeeId },
    });

    return sendSuccess(res, penalty, `Late penalty record successfully ${action}d`);
  } catch (err) {
    next(err);
  }
};

/**
 * 5. GET & POST /api/v1/attendance/critical-dates
 * Critical Dates Calendar
 */
export const getCriticalDates = async (req, res, next) => {
  try {
    const dates = await CriticalDate.find().sort({ date: 1 });
    return sendSuccess(res, dates, 'Critical dates retrieved');
  } catch (err) {
    next(err);
  }
};

export const createCriticalDate = async (req, res, next) => {
  try {
    const { title, date, type = 'event', description = '', department = null } = req.body;
    if (!title || !date) {
      return sendError(res, 'Title and date are required', 400);
    }

    const dateObj = new Date(date);
    const dateStr = dateObj.toISOString().split('T')[0];

    const critical = await CriticalDate.create({
      title,
      date: dateObj,
      dateStr,
      type,
      description,
      department,
      createdBy: req.user._id,
    });

    return sendSuccess(res, critical, 'Critical date registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const deleteCriticalDate = async (req, res, next) => {
  try {
    const { id } = req.params;
    await CriticalDate.findByIdAndDelete(id);
    return sendSuccess(res, null, 'Critical date deleted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 6. GET /api/v1/attendance/unauthorized-absences
 * HR Attention List of unauthorized absences
 */
export const getUnauthorizedAbsences = async (req, res, next) => {
  try {
    const unapproved = await LeaveRequest.find({
      $or: [{ status: 'unauthorized' }, { isUnauthorized: true }],
    })
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('leaveType', 'name code')
      .sort({ fromDate: -1 });

    return sendSuccess(res, unapproved, 'Unauthorized absence records retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 7. POST /api/v1/attendance/unauthorized-absences/:id/action
 * Convert unauthorized absence: approve as leave, convert to LWP, or keep unauthorized
 */
export const actOnUnauthorizedAbsence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body;

    if (!['convert_to_approved', 'convert_to_lwp', 'keep_unauthorized'].includes(action)) {
      return sendError(res, 'Action must be convert_to_approved, convert_to_lwp, or keep_unauthorized', 400);
    }

    const leave = await LeaveRequest.findById(id).populate('employee');
    if (!leave) return sendError(res, 'Record not found', 404);

    leave.hrAction = action;
    if (action === 'convert_to_approved') {
      leave.status = 'approved';
      leave.isUnauthorized = false;
    } else if (action === 'convert_to_lwp') {
      leave.status = 'approved';
      leave.isUnauthorized = false;
      leave.reason = `${leave.reason} [Converted to LWP by HR: ${reason || 'Administrative Decision'}]`;
    } else {
      leave.status = 'unauthorized';
      leave.isUnauthorized = true;
    }

    await leave.save();

    await logAudit({
      req,
      action: `HR_UNAUTHORIZED_ABSENCE_${action.toUpperCase()}`,
      entity: 'LeaveRequest',
      entityId: leave._id,
      changes: { action, reason },
    });

    return sendSuccess(res, leave, `Unauthorized absence action [${action}] recorded successfully`);
  } catch (err) {
    next(err);
  }
};

/**
 * 8. GET /api/v1/attendance/automation/status
 * Get the current Go-Live safety switch status
 */
export const getAutomationStatus = async (req, res, next) => {
  try {
    const policy = await getCompanyPolicy();
    return sendSuccess(
      res,
      {
        automationEnabled: !!policy.automationEnabled,
        automationToggledAt: policy.automationToggledAt,
        automationToggledBy: policy.automationToggledBy,
      },
      'Automation switch status retrieved'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 9. POST /api/v1/attendance/automation/toggle
 * Super Admin only: Toggle go-live safety switch (requires typed confirmation phrase 'ENABLE_AUTOMATION')
 */
export const toggleAutomationSwitch = async (req, res, next) => {
  try {
    const userRole = req.userRole || req.user?.role || req.user?.userRole;
    if (userRole !== 'super_admin') {
      return sendError(res, 'Access denied: Only Super Admin can toggle the Go-Live master automation switch', 403);
    }

    const { enabled } = req.body;
    const confirmation = req.body.confirmationPhrase || req.body.confirmationText;

    if (enabled === true && confirmation !== 'ENABLE_AUTOMATION') {
      return sendError(res, "Typed confirmation phrase must be exactly 'ENABLE_AUTOMATION'", 400);
    }

    const policy = await getCompanyPolicy();
    const prevValue = policy.automationEnabled;
    policy.automationEnabled = !!enabled;
    policy.automationToggledAt = new Date();
    policy.automationToggledBy = req.user._id;

    await policy.save();

    await logAudit({
      req,
      action: enabled ? 'ENABLE_AUTOMATION_SWITCH' : 'DISABLE_AUTOMATION_SWITCH',
      entity: 'AttendancePolicy',
      entityId: policy._id,
      changes: {
        previous: prevValue,
        current: policy.automationEnabled,
        toggledBy: req.user.email,
        timestamp: policy.automationToggledAt,
      },
    });

    return sendSuccess(
      res,
      {
        automationEnabled: policy.automationEnabled,
        automationToggledAt: policy.automationToggledAt,
      },
      `Master Automation switch has been ${policy.automationEnabled ? 'ENABLED (LIVE)' : 'DISABLED (OFF)'}`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 10. GET /api/v1/attendance/automation/preview/monthly-accrual
 * Preview what the 1st of month accrual job would credit (nothing saved or sent)
 */
export const previewMonthlyAccrual = async (req, res, next) => {
  try {
    const { executeMonthlyLeaveAccrual } = await import('../services/leaveAccrual.service.js');
    const now = new Date();
    const result = await executeMonthlyLeaveAccrual({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      preview: true,
    });
    return sendSuccess(res, result, 'Monthly accrual preview generated (zero changes saved)');
  } catch (err) {
    next(err);
  }
};

/**
 * 11. GET /api/v1/attendance/automation/preview/missing-clockout
 * Preview which employees would receive the 19:00 missing clock-out alert (nothing sent)
 */
export const previewMissingClockOut = async (req, res, next) => {
  try {
    const { runMissingClockOutInspection } = await import('../services/cron.service.js');
    const result = await runMissingClockOutInspection({ preview: true });
    return sendSuccess(res, result, '19:00 Missing Clock-out inspection preview (zero notifications sent)');
  } catch (err) {
    next(err);
  }
};

/**
 * 12. GET /api/v1/attendance/automation/preview/eod-not-pa
 * Preview which employees would be marked absent / NOT P/A at 23:59 EOD (nothing created)
 */
export const previewEodNotPa = async (req, res, next) => {
  try {
    const { runDailyEODReconciliation } = await import('../services/cron.service.js');
    const result = await runDailyEODReconciliation({ preview: true });
    return sendSuccess(res, result, '23:59 EOD Absenteeism preview (zero records created)');
  } catch (err) {
    next(err);
  }
};

/**
 * 13. GET /api/v1/attendance/automation/preview/late-penalties
 * Preview current month late arrivals that would be flagged for HR review (nothing saved)
 */
export const previewLatePenalties = async (req, res, next) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const records = await LatePenaltyRecord.find({
      year,
      month,
      isExcused: false,
    }).populate('employee', 'employeeId personal employment');

    const penalties = records.map((r) => ({
      employeeId: r.employee?.employeeId,
      name: `${r.employee?.personal?.firstName || ''} ${r.employee?.personal?.lastName || ''}`.trim(),
      date: r.dateStr,
      entryNumber: r.entryNumberInMonth,
      tier: r.deductionTier,
      lateMinutes: r.lateMinutes,
      status: r.status,
    }));

    return sendSuccess(
      res,
      {
        preview: true,
        count: penalties.length,
        penalties,
      },
      'Late penalties preview generated (zero changes saved)'
    );
  } catch (err) {
    next(err);
  }
};
