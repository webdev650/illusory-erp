import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { LeaveType } from '../models/LeaveType.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { LeavePolicyYear } from '../models/LeavePolicyYear.js';
import { getCompanyPolicy } from './dayStatus.service.js';

/**
 * Calculates continuous service months from the specified anchor date to the target month
 */
export const calculateServiceMonths = (startDate, targetYear, targetMonth) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth() + 1; // 1-12

  const diffYears = targetYear - startYear;
  const diffMonths = diffYears * 12 + (targetMonth - startMonth);
  return Math.max(0, diffMonths);
};

/**
 * Checks whether an employee is eligible for monthly leave accrual in target month
 */
export const isEmployeeEligibleForAccrual = ({
  employee,
  leaveType,
  year,
  month,
  policy,
}) => {
  const joiningDate = (employee.employment?.dateOfJoining || employee.employment?.joiningDate)
    ? new Date(employee.employment?.dateOfJoining || employee.employment?.joiningDate)
    : null;
  const confirmationDate = (employee.employment?.confirmationDate)
    ? new Date(employee.employment.confirmationDate)
    : null;
  const status = employee.status || employee.employment?.status || 'active';

  if (!joiningDate) return { eligible: false, reason: 'No joining date on record' };

  // 1. Probation rule: default OFF
  if (status === 'probation' && policy.accrueDuringProbation === false) {
    return { eligible: false, reason: 'Accrual during probation is disabled in policy (pending HR confirmation)' };
  }

  // 2. Accrual start rule & prorating
  const joinYear = joiningDate.getFullYear();
  const joinMonth = joiningDate.getMonth() + 1;
  const joinDay = joiningDate.getDate();

  if (policy.accrualStartRule === 'from_confirmation') {
    if (!confirmationDate) {
      return { eligible: false, reason: 'Employee is not yet confirmed' };
    }
    const confYear = confirmationDate.getFullYear();
    const confMonth = confirmationDate.getMonth() + 1;
    if (year < confYear || (year === confYear && month < confMonth)) {
      return { eligible: false, reason: 'Target month is prior to confirmation month' };
    }
  } else if (policy.accrualStartRule === 'from_first_full_month') {
    if (joinDay > 1) {
      // Joined mid-month, accrual starts from next calendar month
      if (year < joinYear || (year === joinYear && month <= joinMonth)) {
        return { eligible: false, reason: 'Accrual starts from first full month after joining' };
      }
    } else {
      if (year < joinYear || (year === joinYear && month < joinMonth)) {
        return { eligible: false, reason: 'Target month is prior to joining month' };
      }
    }
  } else {
    // 'from_joining_month' with 15th threshold
    if (year < joinYear || (year === joinYear && month < joinMonth)) {
      return { eligible: false, reason: 'Target month is prior to joining month' };
    }
    if (year === joinYear && month === joinMonth && policy.accrualProrateFirstMonth) {
      if (joinDay > 15) {
        return { eligible: false, reason: 'Joined after the 15th; first accrual begins next month' };
      }
    }
  }

  // 3. Annual Leave 6-month continuous employment barrier
  if (['AL', 'ANNUAL', 'EL', 'EARNED'].includes(leaveType.code)) {
    const serviceAnchor = policy.minServiceFrom === 'confirmation' ? confirmationDate : joiningDate;
    if (!serviceAnchor) {
      return { eligible: false, reason: 'Annual Leave requires confirmed service start anchor' };
    }
    const serviceMonths = calculateServiceMonths(serviceAnchor, year, month);
    const requiredMonths = policy.minServiceMonths || 6;
    if (serviceMonths < requiredMonths) {
      return {
        eligible: false,
        reason: `Annual Leave requires ${requiredMonths} months continuous service (Current: ${serviceMonths} months)`,
      };
    }
  }

  return { eligible: true };
};

/**
 * Execute monthly accrual for a given year & month (1st at 00:10 IST)
 * Completely idempotent: running repeatedly never double-credits.
 */
export const executeMonthlyLeaveAccrual = async ({
  year = new Date().getFullYear(),
  month = new Date().getMonth() + 1,
  overridePolicy = null,
  preview = false,
} = {}) => {
  const policy = overridePolicy || (await getCompanyPolicy());

  // Go-live safety switch: When automationEnabled is false, do not execute real accruals
  if (!policy.automationEnabled && !preview) {
    return {
      year,
      month,
      credited: 0,
      skippedAlreadyAccrued: 0,
      ineligible: 0,
      skippedAutomationOff: true,
      reason: 'Automation is OFF (Go-live safety switch is disabled)',
      details: [],
    };
  }

  // Find or resolve Policy Year
  let policyYear = await LeavePolicyYear.findOne({
    startDate: { $lte: new Date(`${year}-12-31T23:59:59.999Z`) },
    endDate: { $gte: new Date(`${year}-01-01T00:00:00.000Z`) },
  });

  if (!policyYear) {
    policyYear = await LeavePolicyYear.create({
      code: `PY-${year}`,
      name: `Policy Year ${year}`,
      startDate: new Date(`${year}-01-01T00:00:00.000Z`),
      endDate: new Date(`${year}-12-31T23:59:59.999Z`),
      status: 'open',
    });
  }

  // Eligible leave types: Casual Leave (CL) & Annual Leave (AL) configured for monthly accrual
  const leaveTypes = await LeaveType.find({
    accrualMode: 'monthly',
    isActive: true,
  });

  const employees = await Employee.find({
    isDeleted: false,
    $or: [
      { status: { $in: ['active', 'probation', 'notice'] } },
      { 'employment.status': { $in: ['active', 'probation', 'notice'] } },
    ],
  });

  const summary = {
    year,
    month,
    credited: 0,
    skippedAlreadyAccrued: 0,
    ineligible: 0,
    details: [],
  };

  const memoIdentifier = `ACCRUAL_${year}_M${String(month).padStart(2, '0')}`;

  for (const emp of employees) {
    for (const lt of leaveTypes) {
      const eligibility = isEmployeeEligibleForAccrual({
        employee: emp,
        leaveType: lt,
        year,
        month,
        policy,
      });

      if (!eligibility.eligible) {
        summary.ineligible++;
        summary.details.push({
          employee: emp.employeeId,
          leaveType: lt.code,
          status: 'ineligible',
          reason: eligibility.reason,
        });
        continue;
      }

      // Idempotency check: has monthly accrual already run for this employee + leaveType + year + month?
      const existingTx = await LeaveLedger.findOne({
        employee: emp._id,
        leaveType: lt._id,
        policyYear: policyYear._id,
        transactionType: 'monthly_accrual',
        memo: memoIdentifier,
      });

      if (existingTx) {
        summary.skippedAlreadyAccrued++;
        summary.details.push({
          employee: emp.employeeId,
          leaveType: lt.code,
          status: 'already_accrued',
        });
        continue;
      }

      // 1 day = 465 minutes (Rule Book standard shift)
      const creditDays = 1;
      const creditMinutes = 465;

      if (preview) {
        summary.credited++;
        summary.details.push({
          employee: emp.employeeId,
          employeeName: `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim(),
          leaveType: lt.code,
          status: 'would_credit',
          days: creditDays,
          minutes: creditMinutes,
        });
        continue;
      }

      // Update or create LeaveBalance
      let balance = await LeaveBalance.findOne({
        employee: emp._id,
        leaveType: lt._id,
        policyYear: policyYear._id,
      });

      if (!balance) {
        balance = new LeaveBalance({
          employee: emp._id,
          leaveType: lt._id,
          policyYear: policyYear._id,
          year,
          openingMinutes: 0,
          entitlementMinutes: 0,
          allocated: 0,
          allocatedMinutes: 0,
        });
      }

      balance.entitlementMinutes = (balance.entitlementMinutes || 0) + creditMinutes;
      balance.allocated = (balance.allocated || 0) + creditDays;
      balance.allocatedMinutes = (balance.allocatedMinutes || 0) + creditMinutes;
      await balance.save();

      // Record immutable ledger entry
      await LeaveLedger.create({
        employee: emp._id,
        leaveType: lt._id,
        policyYear: policyYear._id,
        date: new Date(`${year}-${String(month).padStart(2, '0')}-01T00:10:00.000Z`),
        transactionType: 'monthly_accrual',
        minutes: creditMinutes,
        days: creditDays,
        memo: memoIdentifier,
        note: `Monthly leave credit: 1 day for ${month}/${year}`,
      });

      summary.credited++;
      summary.details.push({
        employee: emp.employeeId,
        leaveType: lt.code,
        status: 'credited',
        days: creditDays,
        minutes: creditMinutes,
      });
    }
  }

  return summary;
};
