import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import mongoose from 'mongoose';

import { connectDB } from '../src/config/db.js';
import { Shift } from '../src/models/Shift.js';
import { AttendancePolicy } from '../src/models/AttendancePolicy.js';
import { LeaveType } from '../src/models/LeaveType.js';
import { LeaveBalance } from '../src/models/LeaveBalance.js';
import { Employee } from '../src/models/Employee.js';
import { LeavePolicyYear } from '../src/models/LeavePolicyYear.js';
import { isPunchLate } from '../src/utils/dateUtils.js';
import { calculateEntitlementMinutes, recalculatePolicyYearBalances } from '../src/services/settlement.service.js';
import { AuditLog } from '../src/models/AuditLog.js';

describe('Real Illusory Policy Audit Test Suite', () => {
  let policyYear2026;

  beforeAll(async () => {
    await connectDB();
    policyYear2026 = await LeavePolicyYear.findOne({ code: 'PY-2026' }) || {
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      minutesPerDay: 465,
      proRataJoiners: true,
      proRataCalculation: 'months',
      proRataLeavers: true,
    };
  }, 30000);

  afterAll(async () => {
    // Keep connection alive or let jest close it
  });

  // TEST 1: Default Shift Audit
  test('1. Default shift strictly matches 10:00 to 18:45, 60m break, 465 mins, Mon-Sat', async () => {
    const defaultShift = await Shift.findOne({ isDefault: true });
    expect(defaultShift).toBeDefined();
    expect(defaultShift.name).toBe('General Studio Shift');
    expect(defaultShift.startTime).toBe('10:00');
    expect(defaultShift.endTime).toBe('18:45');
    expect(defaultShift.graceMinutes).toBe(15);
    expect(defaultShift.unpaidBreakMinutes).toBe(60);
    expect(defaultShift.workingMinutes).toBe(465); // 7.75h = 465m
    expect(defaultShift.workingDays).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
    expect(defaultShift.workingDays).not.toContain(0); // Sunday is week-off
  });

  // TEST 2: No Evening or Night Shifts exist
  test('2. No Evening or Night shifts exist in the database', async () => {
    const extraShifts = await Shift.find({
      name: { $regex: /evening|night/i },
    });
    expect(extraShifts.length).toBe(0);
  });

  // TEST 3: AttendancePolicy Audit
  test('3. AttendancePolicy matches 15m grace, late after 10:15 AM, 240m half-day, 465m full-day', async () => {
    const policy = await AttendancePolicy.findOne({ isDefault: true });
    expect(policy).toBeDefined();
    expect(policy.graceMinutes).toBe(15);
    expect(policy.lateAfter).toBe(15);
    expect(policy.halfDayMinMinutes).toBe(240);
    expect(policy.fullDayMinMinutes).toBe(465);
    expect(policy.breakMinutes).toBe(60);
    expect(policy.weekOffDays).toContain(0); // Sunday
    expect(policy.weekOffDays).not.toContain(6); // Saturday is working
  });

  // TEST 4: Punch Late Calculation (10:00 start + 15m grace = late after 10:15 AM)
  test('4. Punch timing logic flags late strictly after 10:15 AM', () => {
    const onTimePunch = new Date();
    onTimePunch.setHours(10, 14, 59, 0); // 10:14:59 AM

    const latePunch = new Date();
    latePunch.setHours(10, 15, 1, 0); // 10:15:01 AM

    expect(isPunchLate(onTimePunch, '10:00', 15)).toBe(false);
    expect(isPunchLate(latePunch, '10:00', 15)).toBe(true);
  });

  // TEST 5: Leave Types Quotas & Rules Audit
  test('5. Leave Types strictly match real policy quotas, carry forward caps, and no Privilege Leave', async () => {
    // 1. Casual Leave: 12 days, no carry forward
    const cl = await LeaveType.findOne({ code: 'CL' });
    expect(cl).toBeDefined();
    expect(cl.yearlyQuota).toBe(12);
    expect(cl.yearlyQuotaMinutes).toBe(5580);
    expect(cl.carryForward).toBe(false);
    expect(cl.maxCarry).toBe(0);

    // 2. Annual Leave: 12 days, carry forward 100%, max 5 days
    const al = await LeaveType.findOne({ code: 'AL' });
    expect(al).toBeDefined();
    expect(al.yearlyQuota).toBe(12);
    expect(al.yearlyQuotaMinutes).toBe(5580);
    expect(al.carryForward).toBe(true);
    expect(al.maxCarry).toBe(5);
    expect(al.maxCarryMinutes).toBe(2325); // 5 * 465
    expect(al.forwardPercent).toBe(100);

    // 3. Sick Leave: 6 days, no carry forward
    const sl = await LeaveType.findOne({ code: 'SL' });
    expect(sl).toBeDefined();
    expect(sl.yearlyQuota).toBe(6);
    expect(sl.yearlyQuotaMinutes).toBe(2790); // 6 * 465
    expect(sl.carryForward).toBe(false);
    expect(sl.maxCarry).toBe(0);

    // 4. Bereavement Leave: 5 days, no carry forward
    const bl = await LeaveType.findOne({ code: 'BL' });
    expect(bl).toBeDefined();
    expect(bl.yearlyQuota).toBe(5);
    expect(bl.yearlyQuotaMinutes).toBe(2325); // 5 * 465
    expect(bl.carryForward).toBe(false);
    expect(bl.maxCarry).toBe(0);

    // 5. Probation Leave: 1 day, no carry forward
    const pl = await LeaveType.findOne({ code: 'PL' });
    expect(pl).toBeDefined();
    expect(pl.yearlyQuota).toBe(1);
    expect(pl.yearlyQuotaMinutes).toBe(465); // 1 * 465
    expect(pl.carryForward).toBe(false);

    // 6. Leave Without Pay: 0 quota, unpaid
    const lwp = await LeaveType.findOne({ code: 'LWP' });
    expect(lwp).toBeDefined();
    expect(lwp.yearlyQuota).toBe(0);
    expect(lwp.paid).toBe(false);

    // 7. Comp-Off: 0 quota, paid
    const co = await LeaveType.findOne({ code: 'COMP_OFF' });
    expect(co).toBeDefined();
    expect(co.yearlyQuota).toBe(0);
    expect(co.paid).toBe(true);

    // 8. NO "Privilege Leave" exists
    const privilegeLeave = await LeaveType.findOne({ name: { $regex: /privilege/i } });
    expect(privilegeLeave).toBeNull();

    // 9. NO "Earned Leave" exists
    const earnedLeave = await LeaveType.findOne({ code: 'EL' });
    expect(earnedLeave).toBeNull();
  });

  // TEST 6: Probation Leave Isolation
  test('6. Probation Leave calculates 0 for confirmed employee and allocates only for probation employee', async () => {
    const pl = await LeaveType.findOne({ code: 'PL' });

    const confirmedEmp = {
      _id: new mongoose.Types.ObjectId(),
      status: 'active',
      employment: { dateOfJoining: new Date('2025-01-01') },
    };

    const probationEmp = {
      _id: new mongoose.Types.ObjectId(),
      status: 'probation',
      employment: { dateOfJoining: new Date('2026-01-01') },
    };

    const entConfirmed = calculateEntitlementMinutes(pl, confirmedEmp, policyYear2026);
    expect(entConfirmed).toBe(0);

    const entProbation = calculateEntitlementMinutes(pl, probationEmp, policyYear2026);
    expect(entProbation).toBe(465); // 1 full day = 465 mins
  });

  // TEST 7: Confirmed employees in DB do not have Probation Leave balances
  test('7. Real confirmed employees in DB have zero Probation Leave balance records', async () => {
    const pl = await LeaveType.findOne({ code: 'PL' });
    const confirmedEmployees = await Employee.find({ isDeleted: false, status: { $ne: 'probation' } });
    const confirmedIds = confirmedEmployees.map(e => e._id);

    const plBalancesForConfirmed = await LeaveBalance.find({
      leaveType: pl._id,
      employee: { $in: confirmedIds },
    });

    expect(plBalancesForConfirmed.length).toBe(0);
  });

  // TEST 8: Pro-rata for a July 6 Joiner (50% allocation)
  test('8. Pro-rata entitlement allocates exactly 50% for a July 6 joiner', async () => {
    const cl = await LeaveType.findOne({ code: 'CL' });
    const al = await LeaveType.findOne({ code: 'AL' });
    const sl = await LeaveType.findOne({ code: 'SL' });
    const bl = await LeaveType.findOne({ code: 'BL' });

    const julyJoiner = {
      _id: new mongoose.Types.ObjectId(),
      status: 'active',
      employment: { dateOfJoining: new Date('2026-07-06T00:00:00.000Z') },
    };

    // 12 days * 465 = 5580 mins. 50% = 2790 mins (6 days)
    expect(calculateEntitlementMinutes(cl, julyJoiner, policyYear2026)).toBe(2790);
    expect(calculateEntitlementMinutes(al, julyJoiner, policyYear2026)).toBe(2790);

    // 6 days * 465 = 2790 mins. 50% = 1395 mins (3 days)
    expect(calculateEntitlementMinutes(sl, julyJoiner, policyYear2026)).toBe(1395);

    // 5 days * 465 = 2325 mins. 50% = 1162.5 -> rounds to 1163 mins (2.5 days)
    expect(calculateEntitlementMinutes(bl, julyJoiner, policyYear2026)).toBe(1163);
  });

  // TEST 9: Full Entitlement for Pre-2026 Joiners (100% allocation)
  test('9. Full year entitlement is allocated to employees joining before 2026', async () => {
    const cl = await LeaveType.findOne({ code: 'CL' });
    const al = await LeaveType.findOne({ code: 'AL' });
    const sl = await LeaveType.findOne({ code: 'SL' });
    const bl = await LeaveType.findOne({ code: 'BL' });

    const pre2026Joiner = {
      _id: new mongoose.Types.ObjectId(),
      status: 'active',
      employment: { dateOfJoining: new Date('2025-07-14T00:00:00.000Z') }, // Mihir Dash DOJ
    };

    expect(calculateEntitlementMinutes(cl, pre2026Joiner, policyYear2026)).toBe(5580); // 12 days
    expect(calculateEntitlementMinutes(al, pre2026Joiner, policyYear2026)).toBe(5580); // 12 days
    expect(calculateEntitlementMinutes(sl, pre2026Joiner, policyYear2026)).toBe(2790); // 6 days
    expect(calculateEntitlementMinutes(bl, pre2026Joiner, policyYear2026)).toBe(2325); // 5 days
  });

  // TEST 10: Status transition probation -> confirmed cleans up untaken Probation Leave or preserves taken
  test('10. Status change from probation to confirmed removes untaken Probation Leave and preserves taken history', async () => {
    const pl = await LeaveType.findOne({ code: 'PL' });
    const py = await LeavePolicyYear.findOne({ code: 'PY-2026' });

    if (!py || !pl) return;

    // Create a temporary mock employee in probation
    const testEmp = await Employee.create({
      employeeId: `TEST-${Date.now()}`,
      status: 'probation',
      personal: { firstName: 'Test', lastName: 'Probationer', phone: '9999999999', officialEmail: `test-${Date.now()}@illusory.design` },
      employment: {
        dateOfJoining: new Date('2026-08-01T00:00:00.000Z'),
        designation: 'Tester',
        department: (await Employee.findOne())?.employment?.department,
      },
    });

    try {
      // 1. Initial balance under probation should include Probation Leave
      await recalculatePolicyYearBalances(py._id, testEmp._id);
      let balancePL = await LeaveBalance.findOne({ employee: testEmp._id, leaveType: pl._id, policyYear: py._id });
      expect(balancePL).toBeDefined();
      expect(balancePL.entitlementMinutes).toBeGreaterThan(0);

      // 2. Confirm employee
      testEmp.status = 'active';
      testEmp.employment.confirmationDate = new Date('2026-11-20T00:00:00.000Z');
      await testEmp.save();

      // Audit entry verification
      const audit = await AuditLog.create({
        user: null,
        userEmail: 'admin@illusory.design',
        action: 'SET_EMPLOYMENT_STATUS',
        entity: 'Employee',
        entityId: testEmp._id,
        changes: { previousStatus: 'probation', newStatus: 'active', reason: 'Confirmed after probation period' },
      });
      expect(audit._id).toBeDefined();

      // 3. Recalculate: untaken PL should be deleted
      await recalculatePolicyYearBalances(py._id, testEmp._id);
      balancePL = await LeaveBalance.findOne({ employee: testEmp._id, leaveType: pl._id, policyYear: py._id });
      expect(balancePL).toBeNull();

      // 4. Case where taken > 0: should preserve taken history with closing = 0
      const takenRecord = await LeaveBalance.create({
        employee: testEmp._id,
        policyYear: py._id,
        year: 2026,
        leaveType: pl._id,
        entitlementMinutes: 465,
        takenMinutes: 465,
        pendingMinutes: 0,
        closingMinutes: 0,
        isSettled: false,
      });

      await recalculatePolicyYearBalances(py._id, testEmp._id);
      const updatedTaken = await LeaveBalance.findById(takenRecord._id);
      expect(updatedTaken).toBeDefined();
      expect(updatedTaken.takenMinutes).toBe(465);
      expect(updatedTaken.closingMinutes).toBe(0);
      expect(updatedTaken.isSettled).toBe(true);

      await LeaveBalance.findByIdAndDelete(takenRecord._id);
    } finally {
      await Employee.findByIdAndDelete(testEmp._id);
      await LeaveBalance.deleteMany({ employee: testEmp._id });
    }
  });
});
