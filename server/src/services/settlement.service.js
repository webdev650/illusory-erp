import mongoose from 'mongoose';
import { LeavePolicyYear } from '../models/LeavePolicyYear.js';
import { LeaveBalance } from '../models/LeaveBalance.js';
import { LeaveType } from '../models/LeaveType.js';
import { Employee } from '../models/Employee.js';
import { LeaveRequest } from '../models/LeaveRequest.js';
import { SettlementAudit } from '../models/SettlementAudit.js';
import { LeaveLedger } from '../models/LeaveLedger.js';
import { AttendancePolicy } from '../models/AttendancePolicy.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

const STANDARD_MINUTES_PER_DAY = 465; // 7.75 hours

/**
 * 1. Get or create active LeavePolicyYear
 */
export const getOrCreatePolicyYear = async (yearInput) => {
  const currentYearNum = yearInput ? Number(yearInput) : new Date().getFullYear();
  const code = `PY-${currentYearNum}`;

  let py = await LeavePolicyYear.findOne({ code });
  if (!py) {
    py = await LeavePolicyYear.create({
      code,
      name: `Policy Year ${currentYearNum}`,
      startDate: new Date(`${currentYearNum}-01-01T00:00:00.000Z`),
      endDate: new Date(`${currentYearNum}-12-31T23:59:59.999Z`),
      status: 'open',
      isCurrent: true,
      hoursPerDay: 7.75,
      minutesPerDay: 465,
      proRataCalculation: 'months',
      proRataJoiners: true,
      proRataLeavers: true,
    });
  }
  return py;
};

/**
 * Rounding helper for entitlement in minutes
 */
export const applyEntitlementRounding = (minutes, roundingMode, minutesPerDay = STANDARD_MINUTES_PER_DAY) => {
  if (!roundingMode || roundingMode === 'none') return minutes;
  const days = minutes / minutesPerDay;
  let roundedDays = days;
  if (roundingMode === 'nearest_half') {
    roundedDays = Math.round(days * 2) / 2;
  } else if (roundingMode === 'round_down_half') {
    roundedDays = Math.floor(days * 2) / 2;
  }
  return Math.round(roundedDays * minutesPerDay);
};

/**
 * 2. Calculate Pro-Rata Entitlement in Integer Minutes
 */
export const calculateEntitlementMinutes = (leaveType, employee, policyYear) => {
  const minutesPerDay = policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY;

  // Base yearly quota in minutes
  const baseMinutes = leaveType.yearlyQuotaMinutes > 0
    ? leaveType.yearlyQuotaMinutes
    : (leaveType.yearlyQuota || 0) * minutesPerDay;

  if (baseMinutes === 0) return 0;

  const isProbationLeave = ['PL', 'PROBATION'].includes(leaveType.code) || leaveType.code.startsWith('PL');
  const isEmployeeProbation = employee.status === 'probation';

  // 1. Probation Leave check: strictly reserved for employees on probation
  if (isProbationLeave) {
    if (!isEmployeeProbation) {
      return 0; // Confirmed employees get 0 probation leave
    }
    return applyEntitlementRounding(baseMinutes, policyYear.entitlementRounding, minutesPerDay);
  }

  // 2. Mode: "confirmation" (Regular leave starts from confirmation date)
  if (policyYear.entitlementStart === 'confirmation') {
    // While employee is on probation, they receive ONLY Probation Leave (0 regular leave)
    if (isEmployeeProbation) {
      return 0;
    }

    // Confirmed employee: entitlement starts from confirmationDate
    const rawConfDate = employee.employment?.confirmationDate || employee.confirmationDate;
    const confDate = rawConfDate ? new Date(rawConfDate) : null;
    const pyStart = new Date(policyYear.startDate);
    const pyEnd = new Date(policyYear.endDate);

    let rawMinutes = baseMinutes;

    if (confDate && confDate > pyStart && confDate <= pyEnd) {
      if (leaveType.code === 'BL') {
        // Bereavement Leave in BizCompass stayed full 5 days unprorated
        rawMinutes = baseMinutes;
      } else if (policyYear.proRataCalculation === 'days') {
        const totalDays = Math.round((pyEnd - pyStart) / 86400000) + 1;
        const activeDays = Math.max(0, Math.round((pyEnd - confDate) / 86400000)) + 1;
        rawMinutes = Math.round(baseMinutes * (activeDays / totalDays));
      } else {
        // By months: confirmation on or before 15th counts as full month
        const confMonth = confDate.getUTCMonth();
        const confDay = confDate.getUTCDate();
        let activeMonths = 12 - confMonth;
        if (confDay > 15) {
          activeMonths = Math.max(0, activeMonths - 1);
        }
        rawMinutes = Math.round(baseMinutes * (activeMonths / 12));
      }
    } else if (!confDate) {
      // If no confirmationDate recorded yet, fallback to joining date pro-rata
      const rawJoinDate = employee.employment?.dateOfJoining || employee.employment?.joiningDate;
      const joinDate = rawJoinDate ? new Date(rawJoinDate) : null;
      if (joinDate && joinDate > pyStart && joinDate <= pyEnd) {
        const joinMonth = joinDate.getUTCMonth();
        const joinDay = joinDate.getUTCDate();
        let activeMonths = 12 - joinMonth;
        if (joinDay > 15) activeMonths = Math.max(0, activeMonths - 1);
        rawMinutes = Math.round(baseMinutes * (activeMonths / 12));
      }
    }

    return applyEntitlementRounding(rawMinutes, policyYear.entitlementRounding, minutesPerDay);
  }

  // 3. Mode: "joining" (Default current behaviour: pro-rata from joining date)
  const rawJoinDate = employee.employment?.dateOfJoining || employee.employment?.joiningDate;
  const joinDate = rawJoinDate ? new Date(rawJoinDate) : null;
  const pyStart = new Date(policyYear.startDate);
  const pyEnd = new Date(policyYear.endDate);

  let resultMinutes = baseMinutes;

  if (policyYear.proRataJoiners && joinDate && joinDate > pyStart && joinDate <= pyEnd) {
    if (policyYear.proRataCalculation === 'days') {
      const totalDays = Math.round((pyEnd - pyStart) / 86400000) + 1;
      const activeDays = Math.max(0, Math.round((pyEnd - joinDate) / 86400000)) + 1;
      resultMinutes = Math.round(baseMinutes * (activeDays / totalDays));
    } else {
      // By months (joining on or before 15th counts as full month)
      const joinMonth = joinDate.getUTCMonth();
      const joinDay = joinDate.getUTCDate();
      let activeMonths = 12 - joinMonth;
      if (joinDay > 15) {
        activeMonths = Math.max(0, activeMonths - 1);
      }
      resultMinutes = Math.round(baseMinutes * (activeMonths / 12));
    }
  }

  // Leaver Pro-Rata (resigned, terminated, inactive with exit date in policy year)
  const rawExitDate = employee.employment?.dateOfLeaving || employee.employment?.lastWorkingDay || employee.updatedAt;
  const exitDate = rawExitDate ? new Date(rawExitDate) : null;
  if (
    policyYear.proRataLeavers &&
    ['resigned', 'terminated', 'inactive'].includes(employee.status) &&
    exitDate &&
    exitDate >= pyStart &&
    exitDate <= pyEnd
  ) {
    const exitMonth = exitDate.getUTCMonth() + 1;
    resultMinutes = Math.round(baseMinutes * (exitMonth / 12));
  }

  return applyEntitlementRounding(resultMinutes, policyYear.entitlementRounding, minutesPerDay);
};

/**
 * 3. Settlement Calculation Pure Logic
 *
 * closing = opening + entitlement + carriedIn - taken - pending - encashed
 * carryForward = min(closing * forwardPercent / 100, maxCarryForward)
 * lapsed = closing - carryForward - encashed
 */
export const calculateSettlementRow = ({
  openingMinutes = 0,
  entitlementMinutes = 0,
  carriedInMinutes = 0,
  takenMinutes = 0,
  pendingMinutes = 0,
  forwardType = 'lapsed', // 'lapsed', 'carry_forward', 'encash'
  overrideSettlementMinutes = null,
  leaveType,
  minutesPerDay = STANDARD_MINUTES_PER_DAY,
}) => {
  // Net closing balance before settlement actions
  const grossClosingMinutes = Math.max(
    0,
    openingMinutes + entitlementMinutes + carriedInMinutes - takenMinutes - pendingMinutes
  );

  const forwardPercent = leaveType.forwardPercent !== undefined ? leaveType.forwardPercent : 100;
  const maxCarryMinutes = leaveType.maxCarryMinutes > 0
    ? leaveType.maxCarryMinutes
    : (leaveType.maxCarry || 0) * minutesPerDay;

  let carriedForwardMinutes = 0;
  let encashedMinutes = 0;
  let lapsedMinutes = 0;

  if (forwardType === 'carry_forward') {
    if (leaveType.carryForward) {
      const allowedByPercent = Math.round(grossClosingMinutes * (forwardPercent / 100));
      carriedForwardMinutes = maxCarryMinutes > 0
        ? Math.min(allowedByPercent, maxCarryMinutes)
        : allowedByPercent;
    } else {
      carriedForwardMinutes = 0;
    }
    lapsedMinutes = Math.max(0, grossClosingMinutes - carriedForwardMinutes);
  } else if (forwardType === 'encash') {
    if (leaveType.encashable) {
      encashedMinutes = maxCarryMinutes > 0
        ? Math.min(grossClosingMinutes, maxCarryMinutes)
        : grossClosingMinutes;
    } else {
      encashedMinutes = 0;
    }
    lapsedMinutes = Math.max(0, grossClosingMinutes - encashedMinutes);
  } else {
    // 'lapsed'
    lapsedMinutes = grossClosingMinutes;
  }

  // Handle manual override if provided
  let finalSettlementMinutes = 0;
  if (overrideSettlementMinutes !== null && overrideSettlementMinutes !== undefined) {
    const validatedOverride = Math.max(0, Math.min(grossClosingMinutes, overrideSettlementMinutes));
    finalSettlementMinutes = validatedOverride;

    if (forwardType === 'carry_forward') {
      carriedForwardMinutes = maxCarryMinutes > 0
        ? Math.min(validatedOverride, maxCarryMinutes)
        : validatedOverride;
      lapsedMinutes = Math.max(0, grossClosingMinutes - carriedForwardMinutes);
    } else if (forwardType === 'encash') {
      if (leaveType.encashable) {
        encashedMinutes = validatedOverride;
      } else {
        encashedMinutes = 0;
      }
      lapsedMinutes = Math.max(0, grossClosingMinutes - encashedMinutes);
    } else {
      lapsedMinutes = grossClosingMinutes;
    }
  } else {
    finalSettlementMinutes = forwardType === 'carry_forward'
      ? carriedForwardMinutes
      : forwardType === 'encash'
      ? encashedMinutes
      : 0;
  }

  const closingMinutes = grossClosingMinutes;

  return {
    openingMinutes,
    entitlementMinutes,
    carriedInMinutes,
    takenMinutes,
    pendingMinutes,
    closingMinutes,
    forwardType,
    settlementMinutes: finalSettlementMinutes,
    carriedForwardMinutes,
    encashedMinutes,
    lapsedMinutes,
    // Display values in days (rounded to 2 decimals)
    openingDays: parseFloat((openingMinutes / minutesPerDay).toFixed(2)),
    entitlementDays: parseFloat((entitlementMinutes / minutesPerDay).toFixed(2)),
    carriedInDays: parseFloat((carriedInMinutes / minutesPerDay).toFixed(2)),
    takenDays: parseFloat((takenMinutes / minutesPerDay).toFixed(2)),
    pendingDays: parseFloat((pendingMinutes / minutesPerDay).toFixed(2)),
    closingDays: parseFloat((closingMinutes / minutesPerDay).toFixed(2)),
    settlementDays: parseFloat((finalSettlementMinutes / minutesPerDay).toFixed(2)),
    carriedForwardDays: parseFloat((carriedForwardMinutes / minutesPerDay).toFixed(2)),
    encashedDays: parseFloat((encashedMinutes / minutesPerDay).toFixed(2)),
    lapsedDays: parseFloat((lapsedMinutes / minutesPerDay).toFixed(2)),
  };
};

/**
 * 4. Recalculate and build Balances for Policy Year (Idempotent)
 */
export const recalculatePolicyYearBalances = async (policyYearId, employeeFilter = {}) => {
  const policyYear = await LeavePolicyYear.findById(policyYearId);
  if (!policyYear) throw new Error('Policy Year not found');

  const yearNum = policyYear.startDate.getFullYear();
  const minutesPerDay = policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY;

  let empQuery = { isDeleted: false };
  if (mongoose.isValidObjectId(employeeFilter) || typeof employeeFilter === 'string') {
    empQuery._id = employeeFilter;
  } else if (employeeFilter && typeof employeeFilter === 'object') {
    empQuery = { ...employeeFilter, isDeleted: false };
  }

  const employees = await Employee.find(empQuery);
  const leaveTypes = await LeaveType.find({ isActive: true });

  const results = [];

  for (const emp of employees) {
    for (const lt of leaveTypes) {
      // Probation Leave appears strictly for employees with status 'probation'
      if (['PL', 'PROBATION'].includes(lt.code) && emp.status !== 'probation') {
        const existingBal = await LeaveBalance.findOne({
          employee: emp._id,
          leaveType: lt._id,
          year: yearNum,
        });
        if (existingBal && (existingBal.takenMinutes > 0 || existingBal.used > 0)) {
          // Keep taken history intact, but closing/remaining balance becomes 0
          existingBal.entitlementMinutes = existingBal.takenMinutes;
          existingBal.allocated = existingBal.used;
          existingBal.closingMinutes = 0;
          existingBal.settlementMinutes = 0;
          existingBal.carriedForwardMinutes = 0;
          existingBal.isSettled = true;
          await existingBal.save();
        } else {
          await LeaveBalance.deleteOne({
            employee: emp._id,
            leaveType: lt._id,
            year: yearNum,
          });
        }
        continue;
      }

      let balance = await LeaveBalance.findOne({
        employee: emp._id,
        leaveType: lt._id,
        year: yearNum,
      });

      if (!balance) {
        balance = new LeaveBalance({
          employee: emp._id,
          leaveType: lt._id,
          policyYear: policyYear._id,
          year: yearNum,
        });
      }

      // Compute Entitlement
      const entitlementMinutes = calculateEntitlementMinutes(lt, emp, policyYear);
      balance.entitlementMinutes = entitlementMinutes;
      balance.allocated = parseFloat((entitlementMinutes / minutesPerDay).toFixed(2));

      // Sum actual taken approved leave in policy year
      const takenRequests = await LeaveRequest.find({
        employee: emp._id,
        leaveType: lt._id,
        status: 'approved',
        fromDate: { $gte: policyYear.startDate, $lte: policyYear.endDate },
      });
      const takenMinutes = takenRequests.reduce((sum, r) => sum + (r.minutes || (r.days * minutesPerDay)), 0);
      balance.takenMinutes = takenMinutes;
      balance.used = parseFloat((takenMinutes / minutesPerDay).toFixed(2));

      // Sum pending requests in policy year
      const pendingRequests = await LeaveRequest.find({
        employee: emp._id,
        leaveType: lt._id,
        status: 'pending',
        fromDate: { $gte: policyYear.startDate, $lte: policyYear.endDate },
      });
      const pendingMinutes = pendingRequests.reduce((sum, r) => sum + (r.minutes || (r.days * minutesPerDay)), 0);
      balance.pendingMinutes = pendingMinutes;
      balance.pending = parseFloat((pendingMinutes / minutesPerDay).toFixed(2));

      // Run settlement calculation
      const calc = calculateSettlementRow({
        openingMinutes: balance.openingMinutes || 0,
        entitlementMinutes: balance.entitlementMinutes || 0,
        carriedInMinutes: balance.carriedInMinutes || 0,
        takenMinutes: balance.takenMinutes || 0,
        pendingMinutes: balance.pendingMinutes || 0,
        forwardType: balance.forwardType || 'lapsed',
        overrideSettlementMinutes: balance.isDirty ? balance.settlementMinutes : null,
        leaveType: lt,
        minutesPerDay,
      });

      balance.closingMinutes = calc.closingMinutes;
      balance.settlementMinutes = calc.settlementMinutes;
      balance.carriedForwardMinutes = calc.carriedForwardMinutes;
      balance.encashedMinutes = calc.encashedMinutes;
      balance.lapsedMinutes = calc.lapsedMinutes;
      balance.policyYear = policyYear._id;

      await balance.save();
      results.push(balance);
    }
  }

  return results;
};
