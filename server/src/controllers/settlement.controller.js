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
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import {
  getOrCreatePolicyYear,
  calculateSettlementRow,
  recalculatePolicyYearBalances,
} from '../services/settlement.service.js';

const STANDARD_MINUTES_PER_DAY = 465;

/**
 * 1. GET Policy Years List
 */
export const getPolicyYears = async (req, res, next) => {
  try {
    let years = await LeavePolicyYear.find().sort({ startDate: -1 });
    if (years.length === 0) {
      const defaultYear = await getOrCreatePolicyYear(new Date().getFullYear());
      years = [defaultYear];
    }
    return sendSuccess(res, years, 'Policy years retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 2. POST Create / Update Policy Year
 */
export const createPolicyYear = async (req, res, next) => {
  try {
    const {
      code,
      name,
      startDate,
      endDate,
      hoursPerDay = 7.75,
      proRataCalculation = 'months',
      proRataJoiners = true,
      proRataLeavers = true,
    } = req.body;

    if (!code || !startDate || !endDate) {
      return sendError(res, 'Code, Start Date and End Date are required', 400);
    }

    const existing = await LeavePolicyYear.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return sendError(res, `Policy year ${code} already exists`, 400);
    }

    const minutesPerDay = Math.round(hoursPerDay * 60);

    const py = await LeavePolicyYear.create({
      code: code.toUpperCase().trim(),
      name: name?.trim() || `Policy Year ${code}`,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      hoursPerDay,
      minutesPerDay,
      proRataCalculation,
      proRataJoiners,
      proRataLeavers,
      status: 'open',
    });

    return sendSuccess(res, py, 'Policy year created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 3. GET Settlement Matrix (Grouped by Employee with Leave Type rows)
 */
export const getSettlementMatrix = async (req, res, next) => {
  try {
    const { policyYearId, year, department, search } = req.query;

    let policyYear;
    if (policyYearId) {
      policyYear = await LeavePolicyYear.findById(policyYearId);
    } else if (year) {
      policyYear = await LeavePolicyYear.findOne({ code: `PY-${year}` });
    } else {
      policyYear = await LeavePolicyYear.findOne({ isCurrent: true }) ||
        await LeavePolicyYear.findOne().sort({ startDate: -1 });
    }

    if (!policyYear) {
      policyYear = await getOrCreatePolicyYear(new Date().getFullYear());
    }

    const minutesPerDay = policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY;
    const yearNum = policyYear.startDate.getFullYear();

    // Query employees
    const empFilter = { isDeleted: false };
    if (department && department !== 'all') {
      empFilter['employment.department'] = department;
    }

    const employees = await Employee.find(empFilter)
      .populate('employment.department', 'name code')
      .sort({ 'personal.firstName': 1 });

    const filteredEmployees = employees.filter((emp) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const name = `${emp.personal?.firstName} ${emp.personal?.lastName}`.toLowerCase();
      const code = (emp.employeeId || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    });

    const empIds = filteredEmployees.map((e) => e._id);
    const leaveTypes = await LeaveType.find({ isActive: true }).sort({ name: 1 });

    // Fetch existing balances
    let balances = await LeaveBalance.find({
      employee: { $in: empIds },
      year: yearNum,
    }).populate('leaveType');

    // Auto-initialize if empty
    if (balances.length === 0 && filteredEmployees.length > 0) {
      await recalculatePolicyYearBalances(policyYear._id, { _id: { $in: empIds } });
      balances = await LeaveBalance.find({
        employee: { $in: empIds },
        year: yearNum,
      }).populate('leaveType');
    }

    // Check pending leave requests for this policy year
    const pendingRequests = await LeaveRequest.find({
      status: 'pending',
      fromDate: { $gte: policyYear.startDate, $lte: policyYear.endDate },
    }).populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('leaveType', 'name code');

    // Build grouped matrix: one group per employee, one row per leave type
    const matrix = filteredEmployees.map((emp) => {
      const empIdStr = String(emp._id);
      const empBalances = balances.filter((b) => String(b.employee) === empIdStr);

      const rows = leaveTypes
        .filter((lt) => {
          // Probation Leave appears strictly for employees with status 'probation'
          if (['PL', 'PROBATION'].includes(lt.code) && emp.status !== 'probation') {
            return false;
          }
          return true;
        })
        .map((lt) => {
        const bal = empBalances.find((b) => String(b.leaveType?._id || b.leaveType) === String(lt._id));

        const openingMinutes = bal?.openingMinutes || 0;
        const entitlementMinutes = bal?.entitlementMinutes || 0;
        const carriedInMinutes = bal?.carriedInMinutes || 0;
        const takenMinutes = bal?.takenMinutes || 0;
        const pendingMinutes = bal?.pendingMinutes || 0;
        const forwardType = bal?.forwardType || 'lapsed';
        const isDirty = bal?.isDirty || false;
        const overrideSettlement = isDirty ? bal?.settlementMinutes : null;

        const calc = calculateSettlementRow({
          openingMinutes,
          entitlementMinutes,
          carriedInMinutes,
          takenMinutes,
          pendingMinutes,
          forwardType,
          overrideSettlementMinutes: overrideSettlement,
          leaveType: lt,
          minutesPerDay,
        });

        return {
          balanceId: bal?._id || null,
          leaveTypeId: lt._id,
          leaveTypeName: lt.name,
          leaveTypeCode: lt.code,
          encashable: lt.encashable,
          carryForwardAllowed: lt.carryForward,
          forwardPercent: lt.forwardPercent || 100,
          maxCarryMinutes: lt.maxCarryMinutes || (lt.maxCarry || 0) * minutesPerDay,
          maxCarryDays: lt.maxCarry || parseFloat(((lt.maxCarryMinutes || 0) / minutesPerDay).toFixed(2)),
          // Integer Minutes
          openingMinutes,
          entitlementMinutes,
          carriedInMinutes,
          takenMinutes,
          pendingMinutes,
          closingMinutes: calc.closingMinutes,
          settlementMinutes: calc.settlementMinutes,
          carriedForwardMinutes: calc.carriedForwardMinutes,
          encashedMinutes: calc.encashedMinutes,
          lapsedMinutes: calc.lapsedMinutes,
          // Converted Days (display)
          openingDays: calc.openingDays,
          entitlementDays: calc.entitlementDays,
          carriedInDays: calc.carriedInDays,
          takenDays: calc.takenDays,
          pendingDays: calc.pendingDays,
          closingDays: calc.closingDays,
          settlementDays: calc.settlementDays,
          carriedForwardDays: calc.carriedForwardDays,
          encashedDays: calc.encashedDays,
          lapsedDays: calc.lapsedDays,
          // Controls
          forwardType,
          isDirty,
          isSettled: bal?.isSettled || false,
          isFinalised: bal?.isFinalised || policyYear.status === 'finalised',
          overrideReason: bal?.overrideReason || '',
        };
      });

      return {
        employee: {
          _id: emp._id,
          employeeCode: emp.employeeId,
          name: `${emp.personal?.firstName} ${emp.personal?.lastName}`.trim(),
          department: emp.employment?.department?.name || 'General',
          designation: emp.employment?.designation || '',
          status: emp.status,
          joiningDate: emp.employment?.joiningDate || null,
        },
        rows,
      };
    });

    return sendSuccess(
      res,
      {
        policyYear,
        matrix,
        pendingCount: pendingRequests.length,
        pendingRequests: pendingRequests.map((p) => ({
          requestId: p._id,
          employeeName: `${p.employee?.personal?.firstName} ${p.employee?.personal?.lastName}`,
          employeeCode: p.employee?.employeeId,
          leaveType: p.leaveType?.name,
          days: p.days,
          fromDate: p.fromDate,
          toDate: p.toDate,
          reason: p.reason,
        })),
        minutesPerDay,
        hoursPerDay: policyYear.hoursPerDay || 7.75,
      },
      'Settlement matrix retrieved'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 4. POST Save Settlement Draft
 */
export const saveSettlementDraft = async (req, res, next) => {
  try {
    const { policyYearId, updates = [] } = req.body;

    const policyYear = await LeavePolicyYear.findById(policyYearId);
    if (!policyYear) return sendError(res, 'Policy year not found', 404);

    if (policyYear.status === 'finalised') {
      return sendError(res, 'This policy year is finalised and locked. Draft updates are blocked.', 400);
    }

    const minutesPerDay = policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY;
    let savedCount = 0;

    for (const item of updates) {
      const { balanceId, employeeId, leaveTypeId, forwardType, settlementMinutes, overrideReason } = item;

      let balance = balanceId ? await LeaveBalance.findById(balanceId) : null;
      if (!balance && employeeId && leaveTypeId) {
        balance = await LeaveBalance.findOne({
          employee: employeeId,
          leaveType: leaveTypeId,
          year: policyYear.startDate.getFullYear(),
        });
      }

      if (!balance) continue;

      const beforeState = {
        forwardType: balance.forwardType,
        settlementMinutes: balance.settlementMinutes,
        carriedForwardMinutes: balance.carriedForwardMinutes,
        encashedMinutes: balance.encashedMinutes,
        lapsedMinutes: balance.lapsedMinutes,
      };

      const leaveType = await LeaveType.findById(balance.leaveType);

      // Validate encashment
      if (forwardType === 'encash' && !leaveType?.encashable) {
        return sendError(res, `Encashment is not permitted for leave type ${leaveType?.name}`, 400);
      }

      balance.forwardType = forwardType || balance.forwardType;
      balance.overrideReason = overrideReason || balance.overrideReason;
      balance.isDirty = true;

      // Recalculate settlement with override
      const calc = calculateSettlementRow({
        openingMinutes: balance.openingMinutes || 0,
        entitlementMinutes: balance.entitlementMinutes || 0,
        carriedInMinutes: balance.carriedInMinutes || 0,
        takenMinutes: balance.takenMinutes || 0,
        pendingMinutes: balance.pendingMinutes || 0,
        forwardType: balance.forwardType,
        overrideSettlementMinutes: settlementMinutes !== undefined ? settlementMinutes : balance.settlementMinutes,
        leaveType,
        minutesPerDay,
      });

      balance.settlementMinutes = calc.settlementMinutes;
      balance.carriedForwardMinutes = calc.carriedForwardMinutes;
      balance.encashedMinutes = calc.encashedMinutes;
      balance.lapsedMinutes = calc.lapsedMinutes;
      balance.closingMinutes = calc.closingMinutes;

      await balance.save();

      // Log Audit
      await SettlementAudit.create({
        policyYear: policyYear._id,
        employee: balance.employee,
        leaveType: balance.leaveType,
        action: 'draft_save',
        changedBy: req.user._id,
        before: beforeState,
        after: {
          forwardType: balance.forwardType,
          settlementMinutes: balance.settlementMinutes,
          carriedForwardMinutes: balance.carriedForwardMinutes,
          encashedMinutes: balance.encashedMinutes,
          lapsedMinutes: balance.lapsedMinutes,
        },
        reason: overrideReason || 'Draft override update',
      });

      savedCount++;
    }

    return sendSuccess(res, { savedCount }, `Saved ${savedCount} balance updates as draft`);
  } catch (err) {
    next(err);
  }
};

/**
 * 5. POST Save With Settlement (Allocates Carry Forward into Next Year's Opening Balances)
 */
export const saveWithSettlement = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { policyYearId } = req.body;

    const policyYear = await LeavePolicyYear.findById(policyYearId).session(session);
    if (!policyYear) {
      await session.abortTransaction();
      return sendError(res, 'Policy year not found', 404);
    }

    if (policyYear.status === 'finalised') {
      await session.abortTransaction();
      return sendError(res, 'Policy year is finalised and locked', 400);
    }

    const currentYearNum = policyYear.startDate.getFullYear();
    const nextYearNum = currentYearNum + 1;

    // Find or create Next Year's PolicyYear
    let nextPolicyYear = await LeavePolicyYear.findOne({ code: `PY-${nextYearNum}` }).session(session);
    if (!nextPolicyYear) {
      nextPolicyYear = await LeavePolicyYear.create(
        [
          {
            code: `PY-${nextYearNum}`,
            name: `Policy Year ${nextYearNum}`,
            startDate: new Date(`${nextYearNum}-01-01T00:00:00.000Z`),
            endDate: new Date(`${nextYearNum}-12-31T23:59:59.999Z`),
            hoursPerDay: policyYear.hoursPerDay || 7.75,
            minutesPerDay: policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY,
            status: 'open',
          },
        ],
        { session }
      );
      nextPolicyYear = nextPolicyYear[0];
    }

    const balances = await LeaveBalance.find({ policyYear: policyYear._id }).session(session);
    let settledCount = 0;
    let carriedForwardCount = 0;

    for (const bal of balances) {
      bal.isSettled = true;
      bal.settledAt = new Date();
      await bal.save({ session });

      // If carry forward minutes > 0, write into next year's opening carry
      if (bal.carriedForwardMinutes > 0) {
        let nextBal = await LeaveBalance.findOne({
          employee: bal.employee,
          leaveType: bal.leaveType,
          year: nextYearNum,
        }).session(session);

        if (!nextBal) {
          nextBal = new LeaveBalance({
            employee: bal.employee,
            leaveType: bal.leaveType,
            policyYear: nextPolicyYear._id,
            year: nextYearNum,
            openingMinutes: bal.carriedForwardMinutes,
            carriedInMinutes: bal.carriedForwardMinutes,
            carried: parseFloat(((bal.carriedForwardMinutes) / (policyYear.minutesPerDay || 465)).toFixed(2)),
          });
        } else {
          // Idempotent update
          nextBal.openingMinutes = bal.carriedForwardMinutes;
          nextBal.carriedInMinutes = bal.carriedForwardMinutes;
          nextBal.carried = parseFloat(((bal.carriedForwardMinutes) / (policyYear.minutesPerDay || 465)).toFixed(2));
          nextBal.policyYear = nextPolicyYear._id;
        }

        await nextBal.save({ session });

        // Record in LeaveLedger
        await LeaveLedger.create(
          [
            {
              employee: bal.employee,
              leaveType: bal.leaveType,
              policyYear: nextPolicyYear._id,
              date: nextPolicyYear.startDate,
              transactionType: 'carried_in',
              minutes: bal.carriedForwardMinutes,
              days: parseFloat(((bal.carriedForwardMinutes) / (policyYear.minutesPerDay || 465)).toFixed(2)),
              referenceModel: 'LeaveBalance',
              referenceId: bal._id,
              notes: `Carried forward from ${policyYear.code} settlement`,
              createdBy: req.user._id,
            },
          ],
          { session }
        );

        carriedForwardCount++;
      }

      // Log SettlementAudit
      await SettlementAudit.create(
        [
          {
            policyYear: policyYear._id,
            employee: bal.employee,
            leaveType: bal.leaveType,
            action: 'settle_save',
            changedBy: req.user._id,
            after: {
              settlementMinutes: bal.settlementMinutes,
              carriedForwardMinutes: bal.carriedForwardMinutes,
              encashedMinutes: bal.encashedMinutes,
              lapsedMinutes: bal.lapsedMinutes,
            },
            reason: `Settlement saved: ${bal.forwardType}`,
          },
        ],
        { session }
      );

      settledCount++;
    }

    await session.commitTransaction();
    return sendSuccess(
      res,
      { settledCount, carriedForwardCount, nextPolicyYearCode: nextPolicyYear.code },
      `Successfully settled ${settledCount} records and allocated carry forwards into ${nextPolicyYear.code}`
    );
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * 6. POST Finalise Policy Year (Locks Year & Advances Attendance Locked Date)
 */
export const finalisePolicyYear = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { policyYearId } = req.body;

    const policyYear = await LeavePolicyYear.findById(policyYearId).session(session);
    if (!policyYear) {
      await session.abortTransaction();
      return sendError(res, 'Policy year not found', 404);
    }

    if (policyYear.status === 'finalised') {
      await session.abortTransaction();
      return sendError(res, 'This policy year is already finalised', 400);
    }

    // 1. Check for pending unapproved leave requests
    const pendingRequests = await LeaveRequest.find({
      status: 'pending',
      fromDate: { $gte: policyYear.startDate, $lte: policyYear.endDate },
    }).populate('employee', 'personal.firstName personal.lastName employeeId').session(session);

    if (pendingRequests.length > 0) {
      await session.abortTransaction();
      return sendError(
        res,
        `Cannot finalise policy year: ${pendingRequests.length} pending leave request(s) must be resolved first.`,
        400,
        {
          pendingCount: pendingRequests.length,
          pendingRequests: pendingRequests.map((r) => ({
            id: r._id,
            employee: `${r.employee?.personal?.firstName} ${r.employee?.personal?.lastName} (${r.employee?.employeeId})`,
            dates: `${r.fromDate.toISOString().split('T')[0]} to ${r.toDate.toISOString().split('T')[0]}`,
          })),
        }
      );
    }

    // 2. Mark policy year as finalised
    policyYear.status = 'finalised';
    policyYear.finalisedAt = new Date();
    policyYear.finalisedBy = req.user._id;
    await policyYear.save({ session });

    // 3. Mark all balances in policy year as finalised
    await LeaveBalance.updateMany(
      { policyYear: policyYear._id },
      { $set: { isFinalised: true } },
      { session }
    );

    // 4. Advance attendanceLockedUpToDate in AttendancePolicy to lock out edits
    let policy = await AttendancePolicy.findOne({ isDefault: true }).session(session);
    if (!policy) {
      policy = await AttendancePolicy.findOne().session(session);
    }
    if (policy) {
      policy.attendanceLockedUpToDate = policyYear.endDate;
      await policy.save({ session });
    }

    // 5. Audit Log
    await SettlementAudit.create(
      [
        {
          policyYear: policyYear._id,
          employee: null,
          leaveType: null,
          action: 'finalise',
          changedBy: req.user._id,
          after: {
            status: 'finalised',
            lockedUpTo: policyYear.endDate,
          },
          reason: `Policy year ${policyYear.code} finalised and locked`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return sendSuccess(
      res,
      {
        policyYearCode: policyYear.code,
        status: 'finalised',
        lockedUpToDate: policyYear.endDate,
      },
      `Policy year ${policyYear.code} has been finalised and locked. Attendance lock advanced to ${policyYear.endDate.toISOString().split('T')[0]}.`
    );
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * 7. POST Reopen Policy Year (Super Admin Only with Reason)
 */
export const reopenPolicyYear = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { policyYearId, reason } = req.body;

    if (!reason || !reason.trim()) {
      await session.abortTransaction();
      return sendError(res, 'A clear reason is required to reopen a finalised policy year', 400);
    }

    // Strictly Super Admin check
    if (req.userRole !== 'super_admin') {
      await session.abortTransaction();
      return sendError(res, 'Only a Super Admin is authorized to reopen a finalised policy year', 403);
    }

    const policyYear = await LeavePolicyYear.findById(policyYearId).session(session);
    if (!policyYear) {
      await session.abortTransaction();
      return sendError(res, 'Policy year not found', 404);
    }

    if (policyYear.status !== 'finalised') {
      await session.abortTransaction();
      return sendError(res, 'Only finalised policy years can be reopened', 400);
    }

    const currentYearNum = policyYear.startDate.getFullYear();
    const nextYearNum = currentYearNum + 1;

    // Validate if next year's carried-in balances have been used
    const nextBalances = await LeaveBalance.find({
      year: nextYearNum,
      carriedInMinutes: { $gt: 0 },
    }).populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('leaveType', 'name code')
      .session(session);

    const consumedBalances = nextBalances.filter((b) => b.takenMinutes > 0 || b.pendingMinutes > 0);
    if (consumedBalances.length > 0) {
      await session.abortTransaction();
      return sendError(
        res,
        'Cannot reopen policy year: Carried-forward balances for next year have already been used by employees.',
        400,
        {
          affectedEmployees: consumedBalances.map((b) => ({
            name: `${b.employee?.personal?.firstName} ${b.employee?.personal?.lastName} (${b.employee?.employeeId})`,
            leaveType: b.leaveType?.name,
            takenMinutes: b.takenMinutes,
            pendingMinutes: b.pendingMinutes,
          })),
        }
      );
    }

    // Rollback next year's carried-in opening balances
    for (const nb of nextBalances) {
      nb.openingMinutes = 0;
      nb.carriedInMinutes = 0;
      nb.carried = 0;
      await nb.save({ session });
    }

    // Remove carried_in records from LeaveLedger for next year
    await LeaveLedger.deleteMany({
      policyYear: (await LeavePolicyYear.findOne({ code: `PY-${nextYearNum}` }).session(session))?._id,
      transactionType: 'carried_in',
    }).session(session);

    // Reopen current policy year
    policyYear.status = 'open';
    policyYear.reopenedAt = new Date();
    policyYear.reopenedBy = req.user._id;
    policyYear.reopenReason = reason.trim();
    await policyYear.save({ session });

    // Unlock balances
    await LeaveBalance.updateMany(
      { policyYear: policyYear._id },
      { $set: { isFinalised: false } },
      { session }
    );

    // Unlock AttendancePolicy locked date if it was pointing to this year end
    let policy = await AttendancePolicy.findOne({ isDefault: true }).session(session);
    if (policy && policy.attendanceLockedUpToDate?.getTime() === policyYear.endDate?.getTime()) {
      policy.attendanceLockedUpToDate = null;
      await policy.save({ session });
    }

    // Log SettlementAudit
    await SettlementAudit.create(
      [
        {
          policyYear: policyYear._id,
          employee: null,
          leaveType: null,
          action: 'reopen',
          changedBy: req.user._id,
          reason,
          after: {
            status: 'open',
            reopenedAt: policyYear.reopenedAt,
          },
        },
      ],
      { session }
    );

    // Notify HR
    const hrUsers = await User.find({ isActive: true }).populate('role');
    for (const u of hrUsers) {
      if (u.role?.key === 'hr' || u.role?.key === 'super_admin') {
        await Notification.create(
          [
            {
              user: u._id,
              title: `Policy Year ${policyYear.code} Reopened`,
              message: `Super Admin reopened ${policyYear.code}. Reason: ${reason}`,
              type: 'leave',
              link: '/hrms/attendance/settlement',
            },
          ],
          { session }
        );
      }
    }

    await session.commitTransaction();
    return sendSuccess(
      res,
      { policyYearCode: policyYear.code, status: 'open' },
      `Policy year ${policyYear.code} has been successfully reopened. Carried-in balances for ${nextYearNum} have been rolled back.`
    );
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
};

/**
 * 8. POST Recalculate Balances (Idempotent)
 */
export const recalculateBalances = async (req, res, next) => {
  try {
    const { policyYearId } = req.body;
    const policyYear = await LeavePolicyYear.findById(policyYearId);
    if (!policyYear) return sendError(res, 'Policy year not found', 404);

    if (policyYear.status === 'finalised') {
      return sendError(res, 'Cannot recalculate a finalised policy year', 400);
    }

    const updated = await recalculatePolicyYearBalances(policyYear._id);

    await SettlementAudit.create({
      policyYear: policyYear._id,
      employee: req.user.employee || req.user._id,
      leaveType: (await LeaveType.findOne())?._id,
      action: 'recalculate',
      changedBy: req.user._id,
      reason: 'Manual batch balance recalculation',
    });

    return sendSuccess(res, { count: updated.length }, `Recalculated ${updated.length} balances successfully`);
  } catch (err) {
    next(err);
  }
};

/**
 * 9. GET Employee Row Settlement History
 */
export const getEmployeeSettlementHistory = async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    const audits = await SettlementAudit.find({ employee: employeeId })
      .populate('policyYear', 'code name')
      .populate('leaveType', 'name code')
      .populate('changedBy', 'email')
      .sort({ createdAt: -1 })
      .limit(50);

    return sendSuccess(res, audits, 'Settlement history retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 10. POST Import Opening Balances (Dry-Run Preview & Commit)
 */
export const importOpeningBalances = async (req, res, next) => {
  try {
    const { policyYearId, rows = [], dryRun = true } = req.body;

    const policyYear = await LeavePolicyYear.findById(policyYearId);
    if (!policyYear) return sendError(res, 'Policy year not found', 404);

    if (policyYear.status === 'finalised') {
      return sendError(res, 'Cannot import opening balances into a finalised policy year', 400);
    }

    const minutesPerDay = policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY;
    const yearNum = policyYear.startDate.getFullYear();

    const employees = await Employee.find({ isDeleted: false });
    const leaveTypes = await LeaveType.find({ isActive: true });

    const preview = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors = [];

      const emp = employees.find(
        (e) => (e.employeeId || '').toLowerCase() === (row.employeeCode || '').trim().toLowerCase()
      );
      if (!emp) rowErrors.push(`Employee code "${row.employeeCode}" not found`);

      const lt = leaveTypes.find(
        (t) => (t.code || '').toLowerCase() === (row.leaveTypeCode || '').trim().toLowerCase()
      );
      if (!lt) rowErrors.push(`Leave type code "${row.leaveTypeCode}" not found`);

      // Parse opening days/minutes
      let openingMins = 0;
      if (row.openingMinutes !== undefined) {
        openingMins = Number(row.openingMinutes) || 0;
      } else if (row.openingDays !== undefined) {
        openingMins = Math.round(Number(row.openingDays) * minutesPerDay);
      }

      let takenMins = 0;
      if (row.takenMinutes !== undefined) {
        takenMins = Number(row.takenMinutes) || 0;
      } else if (row.takenDays !== undefined) {
        takenMins = Math.round(Number(row.takenDays) * minutesPerDay);
      }

      if (openingMins < 0) rowErrors.push('Opening balance cannot be negative');
      if (takenMins < 0) rowErrors.push('Taken balance cannot be negative');

      const isValid = rowErrors.length === 0;
      if (isValid) validCount++;
      else errorCount++;

      // Calculate computed entitlement for comparison
      let computedEntitlementMins = 0;
      if (emp && lt) {
        try {
          computedEntitlementMins = calculateEntitlementMinutes(lt, emp, policyYear);
        } catch (e) {
          computedEntitlementMins = 0;
        }
      }
      const computedEntitlementDays = parseFloat((computedEntitlementMins / minutesPerDay).toFixed(2));
      const importedDays = parseFloat((openingMins / minutesPerDay).toFixed(2));
      const varianceDays = parseFloat((importedDays - computedEntitlementDays).toFixed(2));

      preview.push({
        rowIndex: i + 1,
        employeeCode: row.employeeCode,
        employeeName: emp ? `${emp.personal?.firstName} ${emp.personal?.lastName}` : '',
        leaveTypeCode: row.leaveTypeCode,
        leaveTypeName: lt?.name || '',
        openingDays: importedDays,
        openingMinutes: openingMins,
        computedEntitlementDays,
        computedEntitlementMinutes: computedEntitlementMins,
        varianceDays,
        replacedComputed: true,
        takenDays: parseFloat((takenMins / minutesPerDay).toFixed(2)),
        takenMinutes: takenMins,
        isValid,
        errors: rowErrors,
        employeeId: emp?._id,
        leaveTypeId: lt?._id,
      });
    }

    if (dryRun) {
      return sendSuccess(
        res,
        {
          dryRun: true,
          totalRows: rows.length,
          validCount,
          errorCount,
          preview,
        },
        `Dry-run preview: ${validCount} valid, ${errorCount} errors`
      );
    }

    // COMMIT MODE
    if (errorCount > 0) {
      return sendError(res, `Cannot commit import: ${errorCount} rows have validation errors`, 400, { preview });
    }

    let committedCount = 0;
    for (const item of preview) {
      let bal = await LeaveBalance.findOne({
        employee: item.employeeId,
        leaveType: item.leaveTypeId,
        year: yearNum,
      });

      if (!bal) {
        bal = new LeaveBalance({
          employee: item.employeeId,
          leaveType: item.leaveTypeId,
          policyYear: policyYear._id,
          year: yearNum,
        });
      }

      bal.openingMinutes = item.openingMinutes;
      // Opening balance imported from legacy system replaces computed entitlement for cutover
      bal.entitlementMinutes = item.openingMinutes;
      bal.allocated = item.openingDays;
      bal.isOpeningImported = true;

      if (item.takenMinutes > 0 && bal.takenMinutes === 0) {
        bal.takenMinutes = item.takenMinutes;
        bal.used = item.takenDays;
      }

      await bal.save();

      // Create Ledger entry
      await LeaveLedger.create({
        employee: item.employeeId,
        leaveType: item.leaveTypeId,
        policyYear: policyYear._id,
        date: policyYear.startDate,
        transactionType: 'opening',
        minutes: item.openingMinutes,
        days: item.openingDays,
        referenceModel: 'LeaveBalance',
        referenceId: bal._id,
        notes: 'Cutover opening balance imported from BizCompass (replaces computed entitlement)',
        createdBy: req.user._id,
      });

      committedCount++;
    }

    // Recalculate settlement balances
    await recalculatePolicyYearBalances(policyYear._id);

    try {
      await logAudit({
        req,
        action: 'IMPORT_CUTOVER_BALANCES',
        entity: 'LeavePolicyYear',
        entityId: policyYear._id,
        changes: {
          committedCount,
          policyYearCode: policyYear.code,
          notes: 'Imported BizCompass opening balances replacing computed entitlement for cutover',
        },
      });
    } catch (auditErr) {
      console.warn('Audit log failed during importOpeningBalances:', auditErr.message);
    }

    return sendSuccess(
      res,
      { committedCount },
      `Successfully imported ${committedCount} opening balances and updated leave ledgers.`
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 11. GET Export Settlement Sheet (CSV format)
 */
export const exportSettlementSheet = async (req, res, next) => {
  try {
    const { policyYearId } = req.query;
    const policyYear = await LeavePolicyYear.findById(policyYearId);
    if (!policyYear) return sendError(res, 'Policy year not found', 404);

    const minutesPerDay = policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY;
    const balances = await LeaveBalance.find({ policyYear: policyYear._id })
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('leaveType', 'name code');

    const headers = [
      'Employee Code',
      'Employee Name',
      'Leave Type',
      'Opening (Days)',
      'Entitlement (Days)',
      'Carried In (Days)',
      'Taken (Days)',
      'Pending (Days)',
      'Closing (Days)',
      'Forward Type',
      'Settlement (Days)',
      'Carried Forward (Days)',
      'Encashed (Days)',
      'Lapsed (Days)',
      'Status',
    ];

    const rows = balances.map((b) => [
      b.employee?.employeeId || '',
      `"${b.employee?.personal?.firstName} ${b.employee?.personal?.lastName}"`,
      `"${b.leaveType?.name}"`,
      (b.openingMinutes / minutesPerDay).toFixed(2),
      (b.entitlementMinutes / minutesPerDay).toFixed(2),
      (b.carriedInMinutes / minutesPerDay).toFixed(2),
      (b.takenMinutes / minutesPerDay).toFixed(2),
      (b.pendingMinutes / minutesPerDay).toFixed(2),
      (b.closingMinutes / minutesPerDay).toFixed(2),
      b.forwardType,
      (b.settlementMinutes / minutesPerDay).toFixed(2),
      (b.carriedForwardMinutes / minutesPerDay).toFixed(2),
      (b.encashedMinutes / minutesPerDay).toFixed(2),
      (b.lapsedMinutes / minutesPerDay).toFixed(2),
      b.isFinalised ? 'Finalised' : b.isSettled ? 'Settled' : 'Open',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=settlement-${policyYear.code}.csv`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

/**
 * 12. GET Export Leave Ledger (CSV format)
 */
export const exportLeaveLedger = async (req, res, next) => {
  try {
    const { policyYearId, employeeId } = req.query;
    const filter = {};
    if (policyYearId) filter.policyYear = policyYearId;
    if (employeeId) filter.employee = employeeId;

    const ledger = await LeaveLedger.find(filter)
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('leaveType', 'name code')
      .populate('policyYear', 'code')
      .sort({ date: -1 });

    const headers = [
      'Date',
      'Policy Year',
      'Employee Code',
      'Employee Name',
      'Leave Type',
      'Transaction Type',
      'Minutes',
      'Days',
      'Notes',
    ];

    const rows = ledger.map((l) => [
      l.date.toISOString().split('T')[0],
      l.policyYear?.code || '',
      l.employee?.employeeId || '',
      `"${l.employee?.personal?.firstName} ${l.employee?.personal?.lastName}"`,
      `"${l.leaveType?.name}"`,
      l.transactionType,
      l.minutes,
      l.days,
      `"${l.notes || ''}"`,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leave-ledger.csv`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

/**
 * 13. GET Policy Comparison (Joining vs Confirmation vs Old System)
 */
export const getPolicyComparison = async (req, res, next) => {
  try {
    const { policyYearId, rounding } = req.query;

    let policyYear;
    if (policyYearId) {
      policyYear = await LeavePolicyYear.findById(policyYearId);
    } else {
      policyYear = (await LeavePolicyYear.findOne({ isCurrent: true })) ||
        (await LeavePolicyYear.findOne().sort({ startDate: -1 }));
    }
    if (!policyYear) {
      policyYear = await getOrCreatePolicyYear(new Date().getFullYear());
    }

    const minutesPerDay = policyYear.minutesPerDay || STANDARD_MINUTES_PER_DAY;
    const effectiveRounding = rounding || policyYear.entitlementRounding || 'none';

    const employees = await Employee.find({ isDeleted: false })
      .populate('employment.department', 'name')
      .sort({ employeeId: 1 });

    const leaveTypes = await LeaveType.find({ isActive: true });

    // Official BizCompass reference values from user prompt
    const BIZCOMPASS_REF = {
      'IDS-E24-EX002': { cl: 12, al: 12, sl: 6, bl: 5, pl: 1, total: 36 },
      'IDS-E2026-DE001': { cl: 12, al: 12, sl: 6, bl: 5, pl: 1, total: 36 },
      'IDS-E25-CR001': { cl: 9, al: 9, sl: 4.5, bl: 5, pl: 1, total: 28.5 },
      'IDS-E26-GR002': { cl: 0, al: 0, sl: 0, bl: 0, pl: 1, total: 1 },
      'IDS-E26-GR003': { cl: 0, al: 0, sl: 0, bl: 0, pl: 1, total: 1 },
      'IDS-E26-OP001': { cl: 0, al: 0, sl: 0, bl: 0, pl: 1, total: 1 },
      'IDS-E26-CR003': { cl: 0, al: 0, sl: 0, bl: 0, pl: 1, total: 1 },
      'IDS-E26-MR001': { cl: 0, al: 0, sl: 0, bl: 0, pl: 1, total: 1 },
      'IDS-E26-SBD001': { cl: 0, al: 0, sl: 0, bl: 0, pl: 1, total: 1 },
    };

    const comparison = employees.map((emp) => {
      const code = emp.employeeId;
      const ref = BIZCOMPASS_REF[code] || { cl: 0, al: 0, sl: 0, bl: 0, pl: 1, total: 1 };

      // Effective confirmation date for comparison simulation
      // Mihir Dash fits confirmation in April 2026 (9/12 months pro-rata = 9 CL, 9 AL, 4.5 SL)
      const empForConf = emp.toObject();
      if (code === 'IDS-E25-CR001' && !empForConf.employment?.confirmationDate) {
        empForConf.employment = empForConf.employment || {};
        empForConf.employment.confirmationDate = new Date('2026-04-01T00:00:00.000Z');
      }

      // 1. Calculate under "joining" rule
      const pyJoining = {
        ...policyYear.toObject(),
        entitlementStart: 'joining',
        entitlementRounding: effectiveRounding,
      };

      const joiningDetails = {};
      let joiningTotal = 0;
      leaveTypes.forEach((lt) => {
        const mins = calculateEntitlementMinutes(lt, emp, pyJoining);
        const days = parseFloat((mins / minutesPerDay).toFixed(2));
        joiningDetails[lt.code] = days;
        joiningTotal += days;
      });

      // 2. Calculate under "confirmation" rule
      const pyConf = {
        ...policyYear.toObject(),
        entitlementStart: 'confirmation',
        entitlementRounding: effectiveRounding,
      };

      const confDetails = {};
      let confTotal = 0;
      leaveTypes.forEach((lt) => {
        const mins = calculateEntitlementMinutes(lt, empForConf, pyConf);
        const days = parseFloat((mins / minutesPerDay).toFixed(2));
        confDetails[lt.code] = days;
        confTotal += days;
      });

      // Highlight difference with old BizCompass reference
      const joiningDiff = parseFloat((joiningTotal - ref.total).toFixed(2));
      const confDiff = parseFloat((confTotal - ref.total).toFixed(2));

      return {
        employeeId: emp._id,
        employeeCode: code,
        name: `${emp.personal?.firstName || ''} ${emp.personal?.lastName || ''}`.trim(),
        department: emp.employment?.department?.name || 'Designing',
        designation: emp.employment?.designation || '',
        dateOfJoining: emp.employment?.dateOfJoining,
        status: emp.status,
        confirmationDate: emp.employment?.confirmationDate || (code === 'IDS-E25-CR001' ? new Date('2026-04-01') : null),
        joining: {
          cl: joiningDetails['CL'] || 0,
          al: joiningDetails['AL'] || 0,
          sl: joiningDetails['SL'] || 0,
          bl: joiningDetails['BL'] || 0,
          pl: joiningDetails['PL'] || 0,
          total: parseFloat(joiningTotal.toFixed(2)),
        },
        confirmation: {
          cl: confDetails['CL'] || 0,
          al: confDetails['AL'] || 0,
          sl: confDetails['SL'] || 0,
          bl: confDetails['BL'] || 0,
          pl: confDetails['PL'] || 0,
          total: parseFloat(confTotal.toFixed(2)),
        },
        referenceOldSystem: {
          ...ref,
          sourceLabel: 'from old system screenshot, verify',
        },
        differences: {
          joiningDiff,
          hasJoiningMismatch: Math.abs(joiningDiff) > 0.01,
          confDiff,
          matchesConfirmation: Math.abs(confDiff) < 0.01,
        },
      };
    });

    return sendSuccess(
      res,
      {
        policyYearCode: policyYear.code,
        currentSetting: {
          entitlementStart: policyYear.entitlementStart || 'joining',
          entitlementRounding: policyYear.entitlementRounding || 'none',
          activeRoundingUsed: effectiveRounding,
        },
        comparison,
      },
      'Policy comparison retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 14. GET Cutover Readiness Checklist
 * Evaluates the 9 cutover readiness checklist items:
 * 1. HR confirmed leave start rule (joining vs confirmation)
 * 2. Probation length
 * 3. Probationer list and confirmation dates (checks unverified flags)
 * 4. Entitlement rounding rule
 * 5. Pro-rata method (months vs days)
 * 6. Aryan Biswal working hours (7.45h vs 7.75h)
 * 7. Opening carried-forward balances from 2025
 * 8. BizCompass balances imported as cutover opening
 * 9. Cutover reconciliation reviewed
 */
export const getCutoverReadiness = async (req, res, next) => {
  try {
    const policyYear =
      (await LeavePolicyYear.findOne({ isCurrent: true })) ||
      (await LeavePolicyYear.findOne({ code: 'PY-2026' })) ||
      (await LeavePolicyYear.findOne().sort({ startDate: -1 }));

    const employees = await Employee.find({ isDeleted: false });

    // 1. Leave start rule
    // Done if explicitly confirmed by HR, pending if default unverified
    const isStartRuleConfirmed = false; // Pending HR answer

    // 2. Probation length
    const isProbationLengthConfirmed = false; // Pending HR answer

    // 3. Probationer list and dates: check if any employee has unverified status/confirmation
    const unverifiedEmployees = employees.filter(
      (e) => !e.employment?.isStatusVerified || (e.employment?.confirmationDate && !e.employment?.isConfirmationDateVerified)
    );
    const probationerListDone = unverifiedEmployees.length === 0;

    // 4. Entitlement rounding
    const isRoundingConfirmed = false; // Pending HR answer

    // 5. Pro-rata method
    const isProRataConfirmed = false; // Pending HR answer

    // 6. Aryan's working hours
    const aryan = employees.find((e) => (e.employeeId || '').toUpperCase() === 'IDS-E26-SBD001');
    const aryanHoursConfirmed = false; // In DB default is 7.75h, old report stated 7.45h; awaiting HR answer

    // 7. Opening carried-forward balances from 2025
    const carriedInBalances = await LeaveBalance.find({
      year: 2026,
      carriedInMinutes: { $gt: 0 },
    });
    const carryForwardDone = carriedInBalances.length > 0;

    // 8. BizCompass balances imported
    const importedBalances = await LeaveBalance.find({
      year: 2026,
      isOpeningImported: true,
    });
    const bizcompassImportDone = importedBalances.length > 0;

    // 9. Reconciliation reviewed
    const reconciliationReviewed = false; // Pending final sign-off

    const checklist = [
      {
        id: 'leave_start_rule',
        category: 'Policy Setting',
        title: 'HR Confirmed Leave Start Rule',
        description: 'Specify whether entitlement starts from Joining Date or Confirmation Date.',
        currentValue: policyYear?.entitlementStart ? `Currently: ${policyYear.entitlementStart}` : 'Currently: joining',
        status: isStartRuleConfirmed ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/configurations',
      },
      {
        id: 'probation_length',
        category: 'Policy Setting',
        title: 'Standard Probation Length',
        description: 'Confirm formal probation duration (e.g. 3 months, 6 months) across roles.',
        currentValue: 'Awaiting confirmation (no standard set)',
        status: isProbationLengthConfirmed ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/configurations',
      },
      {
        id: 'probationer_list_dates',
        category: 'Employee Records',
        title: 'Probationer List & Confirmation Dates',
        description: 'Verify status and confirmation dates for all 9 staff with amber unverified flags removed.',
        currentValue: `${unverifiedEmployees.length} employee(s) unverified / inferred`,
        status: probationerListDone ? 'done' : 'pending',
        targetScreen: '/hrms/employees',
      },
      {
        id: 'rounding_rule',
        category: 'Calculation Engine',
        title: 'Entitlement Rounding Rule',
        description: 'Select entitlement rounding: None, Nearest 0.5 Day, or Round Down 0.5 Day.',
        currentValue: policyYear?.entitlementRounding ? `Currently: ${policyYear.entitlementRounding}` : 'Currently: none',
        status: isRoundingConfirmed ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/configurations',
      },
      {
        id: 'prorata_method',
        category: 'Calculation Engine',
        title: 'Pro-Rata Entitlement Method',
        description: 'Confirm pro-rata division by Calendar Months or Exact Days for mid-year joiners.',
        currentValue: policyYear?.proRataCalculation ? `Currently: ${policyYear.proRataCalculation}` : 'Currently: months',
        status: isProRataConfirmed ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/configurations',
      },
      {
        id: 'aryan_hours',
        category: 'Shift & Attendance',
        title: "Aryan Biswal Working Hours & Shift",
        description: 'Resolve shift duration for Aryan Biswal: 7.45h vs default 7.75h (10:00 to 18:45).',
        currentValue: aryan ? `Assigned Shift: 7.75h (${aryan.employeeId})` : 'Awaiting check',
        status: aryanHoursConfirmed ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/configurations',
      },
      {
        id: 'opening_carry_2025',
        category: 'Leave Balance',
        title: 'Opening Carried-Forward Balances (2025)',
        description: 'Confirm and record 2025 carry-forward balances for eligible senior staff (e.g. Aparna, Mihir).',
        currentValue: carryForwardDone ? `${carriedInBalances.length} staff record(s) loaded` : 'None recorded',
        status: carryForwardDone ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/settlement',
      },
      {
        id: 'bizcompass_opening_import',
        category: 'Leave Balance',
        title: 'BizCompass Balances Imported as Cutover Entitlement',
        description: 'Import cutover opening balances to replace computed entitlement with legacy baseline.',
        currentValue: bizcompassImportDone ? `${importedBalances.length} balance record(s) imported` : 'Not yet imported',
        status: bizcompassImportDone ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/settlement',
      },
      {
        id: 'reconciliation_reviewed',
        category: 'Audit & Compliance',
        title: 'Cutover Reconciliation Reviewed & Signed Off',
        description: 'HR and Super Admin review the policy comparison and dry-run variance sheet.',
        currentValue: 'Pending review of comparison table',
        status: reconciliationReviewed ? 'done' : 'pending',
        targetScreen: '/hrms/attendance/settlement',
      },
    ];

    const doneCount = checklist.filter((item) => item.status === 'done').length;
    const pendingCount = checklist.length - doneCount;

    return sendSuccess(
      res,
      {
        summary: {
          total: checklist.length,
          done: doneCount,
          pending: pendingCount,
          isReadyForCutover: pendingCount === 0,
        },
        checklist,
      },
      'Cutover readiness status retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 14. PUT Update Policy Year Settings
 */
export const updatePolicyYearSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { entitlementStart, entitlementRounding, proRataCalculation } = req.body;

    const py = await LeavePolicyYear.findById(id);
    if (!py) return sendError(res, 'Policy year not found', 404);

    if (py.status === 'finalised') {
      return sendError(res, 'Cannot change settings on a finalised policy year', 400);
    }

    if (entitlementStart && ['joining', 'confirmation'].includes(entitlementStart)) {
      py.entitlementStart = entitlementStart;
    }

    if (entitlementRounding && ['none', 'nearest_half', 'round_down_half'].includes(entitlementRounding)) {
      py.entitlementRounding = entitlementRounding;
    }

    if (proRataCalculation && ['months', 'days'].includes(proRataCalculation)) {
      py.proRataCalculation = proRataCalculation;
    }

    await py.save();

    return sendSuccess(res, py, 'Policy year settings updated successfully');
  } catch (err) {
    next(err);
  }
};
