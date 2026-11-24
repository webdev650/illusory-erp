import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { LeavePolicyYear } from '../models/LeavePolicyYear.js';
import { recalculatePolicyYearBalances } from './settlement.service.js';
import { initiateExitClearance } from './asset.service.js';

/**
 * Checks for circular reporting loops (e.g. A reports to B reports to A)
 */
export const checkManagerLoop = async (employeeId, proposedManagerId) => {
  if (!proposedManagerId) return false;
  if (String(employeeId) === String(proposedManagerId)) return true;

  let currentId = proposedManagerId;
  const visited = new Set([String(employeeId)]);

  while (currentId) {
    if (visited.has(String(currentId))) {
      return true; // Loop detected
    }
    visited.add(String(currentId));

    const mgr = await Employee.findById(currentId).select('employment.reportingManager');
    currentId = mgr?.employment?.reportingManager || null;
  }

  return false;
};

/**
 * Execute a lifecycle action on an employee record
 */
export const executeLifecycleAction = async ({
  employeeId,
  action,
  payload = {},
  performedByUserId,
  reason = '',
  effectiveDate = null,
}) => {
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new Error('Employee not found');

  const now = new Date();
  const targetDate = effectiveDate ? new Date(effectiveDate) : now;

  // If effective date is in the future, schedule the change
  if (targetDate > now && Math.abs(targetDate.getTime() - now.getTime()) > 3600000) {
    employee.scheduledChanges.push({
      actionType: action,
      effectiveDate: targetDate,
      payload,
      reason,
      status: 'pending',
    });
    await employee.save();
    return {
      isScheduled: true,
      scheduledChange: employee.scheduledChanges[employee.scheduledChanges.length - 1],
    };
  }

  const oldDesignation = employee.employment?.designation;
  const oldDept = employee.employment?.department;
  const oldManager = employee.employment?.reportingManager;
  const oldStatus = employee.status;

  switch (action) {
    case 'confirm_probation': {
      const confDate = payload.confirmationDate ? new Date(payload.confirmationDate) : now;
      employee.status = 'active';
      employee.employment.confirmationDate = confDate;
      employee.employment.probationEndDate = confDate;
      employee.employment.employeeType = 'Full-Time';
      employee.employment.isConfirmationDateVerified = true;
      employee.employment.isStatusVerified = true;

      employee.history.push({
        date: now,
        type: 'CONFIRMED_AFTER_PROBATION',
        from: 'probation',
        to: 'active',
        remarks: reason || 'Completed probation review evaluation and confirmed.',
      });

      // Recalculate 2026 leave balances
      try {
        const activePy = await LeavePolicyYear.findOne({ isCurrent: true }) || await LeavePolicyYear.findOne({ code: 'PY-2026' });
        if (activePy) await recalculatePolicyYearBalances(activePy._id, { _id: employee._id });
      } catch (recalcErr) {
        console.warn('Balance recalc warning:', recalcErr.message);
      }
      break;
    }

    case 'extend_probation': {
      if (!payload.newEndDate) throw new Error('New probation end date is required');
      const newEnd = new Date(payload.newEndDate);
      const prevEnd = employee.employment.probationEndDate;
      employee.employment.probationEndDate = newEnd;
      employee.status = 'probation';
      employee.employment.isStatusVerified = true;

      employee.history.push({
        date: now,
        type: 'EXTEND_PROBATION',
        from: prevEnd ? prevEnd.toISOString().split('T')[0] : 'N/A',
        to: newEnd.toISOString().split('T')[0],
        remarks: reason || 'Probation extended based on periodic review.',
      });
      break;
    }

    case 'promote': {
      if (!payload.newDesignation) throw new Error('New designation is required');
      employee.employment.designation = payload.newDesignation;
      if (payload.newGrade) employee.employment.grade = payload.newGrade;

      employee.history.push({
        date: now,
        type: 'PROMOTED',
        from: oldDesignation,
        to: payload.newDesignation,
        remarks: reason || `Promoted to ${payload.newDesignation}`,
      });
      break;
    }

    case 'transfer': {
      if (payload.newDepartment) employee.employment.department = payload.newDepartment;
      if (payload.newTeam) employee.employment.team = payload.newTeam;
      if (payload.newWorkLocation) employee.employment.workLocation = payload.newWorkLocation;

      employee.history.push({
        date: now,
        type: 'TRANSFERRED',
        from: String(oldDept),
        to: String(payload.newDepartment || oldDept),
        remarks: reason || 'Internal department/location transfer.',
      });
      break;
    }

    case 'change_manager': {
      const isLoop = await checkManagerLoop(employee._id, payload.newManagerId);
      if (isLoop) throw new Error('Circular reporting loop detected: cannot assign this manager');

      employee.employment.reportingManager = payload.newManagerId || null;

      employee.history.push({
        date: now,
        type: 'MANAGER_CHANGE',
        from: oldManager ? String(oldManager) : 'Unassigned',
        to: payload.newManagerId ? String(payload.newManagerId) : 'Unassigned',
        remarks: reason || 'Reporting manager changed.',
      });
      break;
    }

    case 'assign_shift': {
      if (!payload.shiftId) throw new Error('Shift ID is required');
      employee.employment.shift = payload.shiftId;

      employee.history.push({
        date: now,
        type: 'SHIFT_ASSIGNMENT',
        from: 'Previous Shift',
        to: String(payload.shiftId),
        remarks: reason || 'Work shift assigned/updated.',
      });
      break;
    }

    case 'resign': {
      employee.status = 'notice';
      employee.exit = {
        type: 'Resignation',
        resignationDate: payload.resignationDate ? new Date(payload.resignationDate) : now,
        lastWorkingDay: payload.lastWorkingDay ? new Date(payload.lastWorkingDay) : new Date(now.getTime() + (employee.employment?.noticePeriodDays || 30) * 86400000),
        reason: reason || 'Voluntary resignation',
        fnfStatus: 'Pending',
      };

      employee.history.push({
        date: now,
        type: 'RESIGNATION_SUBMITTED',
        from: oldStatus,
        to: 'notice',
        remarks: reason || 'Recorded voluntary resignation.',
      });

      // Initiate exit clearance
      try {
        await initiateExitClearance(employee._id);
      } catch (err) {
        console.warn('Exit clearance initiation failed:', err.message);
      }
      break;
    }

    case 'terminate': {
      employee.status = 'terminated';
      employee.exit = {
        type: 'Termination',
        resignationDate: now,
        lastWorkingDay: payload.lastWorkingDay ? new Date(payload.lastWorkingDay) : now,
        reason: reason || 'Employment terminated',
        fnfStatus: 'Pending',
      };

      if (payload.immediateAccessRemoval !== false) {
        await User.updateOne({ employee: employee._id }, { isActive: false });
      }

      employee.history.push({
        date: now,
        type: 'TERMINATED',
        from: oldStatus,
        to: 'terminated',
        remarks: reason || 'Administrative termination.',
      });

      try {
        await initiateExitClearance(employee._id);
      } catch (err) {
        console.warn('Exit clearance initiation failed:', err.message);
      }
      break;
    }

    default:
      throw new Error(`Unsupported lifecycle action: ${action}`);
  }

  await employee.save();
  return { isScheduled: false, employee };
};
