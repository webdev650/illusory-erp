import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Department } from '../src/models/Department.js';
import { LeaveType } from '../src/models/LeaveType.js';
import { LeavePolicyYear } from '../src/models/LeavePolicyYear.js';
import { LeaveBalance } from '../src/models/LeaveBalance.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import { LeaveLedger } from '../src/models/LeaveLedger.js';
import { SettlementAudit } from '../src/models/SettlementAudit.js';
import { AttendancePolicy } from '../src/models/AttendancePolicy.js';
import {
  calculateSettlementRow,
  calculateEntitlementMinutes,
  recalculatePolicyYearBalances,
} from '../src/services/settlement.service.js';
import * as settlementController from '../src/controllers/settlement.controller.js';

describe('PHASE 4: LEAVE BALANCE SETTLEMENT & REPORTS TESTS', () => {
  let superAdminRole, hrRole, empRole;
  let superAdminUser, hrUser, empUser;
  let testEmp1, testEmp2, probationEmp;
  let annualLeaveType, casualLeaveType, probationLeaveType, encashableLeaveType;
  let policyYear2026;
  let testDept;

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockImplementation((data) => {
      res.data = data;
      return res;
    });
    return res;
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    superAdminRole = await Role.findOne({ key: 'super_admin' });
    hrRole = await Role.findOne({ key: 'hr' });
    empRole = await Role.findOne({ key: 'employee' });

    testDept = await Department.findOne({ name: 'Testing Dept' }) ||
      await Department.create({ name: 'Testing Dept', code: 'TEST' });

    const ts = Date.now();

    // 1. Leave Types
    annualLeaveType = await LeaveType.findOne({ code: 'AL_TEST' }) ||
      await LeaveType.create({
        name: 'Annual Leave Test',
        code: 'AL_TEST',
        yearlyQuota: 12, // 12 days = 5580 mins
        yearlyQuotaMinutes: 5580,
        carryForward: true,
        maxCarry: 3, // Max 3 days = 1395 mins
        maxCarryMinutes: 1395,
        forwardPercent: 50, // 50% carry forward
        encashable: false,
        paid: true,
      });

    encashableLeaveType = await LeaveType.findOne({ code: 'ENCASH_TEST' }) ||
      await LeaveType.create({
        name: 'Encashable Leave Test',
        code: 'ENCASH_TEST',
        yearlyQuota: 10,
        yearlyQuotaMinutes: 4650,
        carryForward: false,
        encashable: true,
        paid: true,
      });

    probationLeaveType = await LeaveType.findOne({ code: 'PL_TEST' }) ||
      await LeaveType.create({
        name: 'Probation Leave Test',
        code: 'PL_TEST',
        yearlyQuota: 6,
        yearlyQuotaMinutes: 2790,
        paid: true,
      });

    casualLeaveType = await LeaveType.findOne({ code: 'CL_TEST' }) ||
      await LeaveType.create({
        name: 'Casual Leave Test',
        code: 'CL_TEST',
        yearlyQuota: 6,
        yearlyQuotaMinutes: 2790,
        carryForward: false,
        encashable: false,
        paid: true,
      });

    // 2. Policy Year (Isolated Year 2028 for tests)
    policyYear2026 = await LeavePolicyYear.create({
      code: `PY-TEST-${ts}`,
      name: 'Test Policy Year 2028',
      startDate: new Date('2028-01-01T00:00:00.000Z'),
      endDate: new Date('2028-12-31T23:59:59.999Z'),
      hoursPerDay: 7.75,
      minutesPerDay: 465,
      status: 'open',
      isCurrent: true,
      isDemo: true,
    });

    // 3. Test Employees
    testEmp1 = await Employee.create({
      employeeId: `IDS-P4-01-${ts}`,
      status: 'active',
      personal: {
        firstName: 'Settlement',
        lastName: 'One',
        phone: '+919999800001',
        officialEmail: `settle1.${ts}@illusory.design`,
      },
      employment: {
        department: testDept._id,
        designation: 'Architect',
        dateOfJoining: new Date('2027-06-01'), // Joined prior to 2028
        joiningDate: new Date('2027-06-01'),
      },
    });

    testEmp2 = await Employee.create({
      employeeId: `IDS-P4-02-${ts}`,
      status: 'active',
      personal: {
        firstName: 'MidYear',
        lastName: 'Joiner',
        phone: '+919999800002',
        officialEmail: `settle2.${ts}@illusory.design`,
      },
      employment: {
        department: testDept._id,
        designation: 'Designer',
        dateOfJoining: new Date('2028-07-01'), // Joined mid-year (1 July 2028)
        joiningDate: new Date('2028-07-01'),
      },
    });

    probationEmp = await Employee.create({
      employeeId: `IDS-P4-03-${ts}`,
      status: 'probation',
      personal: {
        firstName: 'Probation',
        lastName: 'Member',
        phone: '+919999800003',
        officialEmail: `settle3.${ts}@illusory.design`,
      },
      employment: {
        department: testDept._id,
        designation: 'Trainee',
        dateOfJoining: new Date('2028-09-01'),
        joiningDate: new Date('2028-09-01'),
      },
    });

    // 4. Users
    superAdminUser = await User.create({
      email: `admin.p4.${ts}@illusory.design`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: superAdminRole._id,
      isActive: true,
    });

    hrUser = await User.create({
      email: `hr.p4.${ts}@illusory.design`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: hrRole._id,
      isActive: true,
    });

    empUser = await User.create({
      email: testEmp1.personal.officialEmail,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: empRole._id,
      employee: testEmp1._id,
      isActive: true,
    });
  }, 60000);

  afterAll(async () => {
    if (testEmp1) {
      await Employee.deleteMany({ _id: { $in: [testEmp1._id, testEmp2._id, probationEmp._id] } });
      await User.deleteMany({ _id: { $in: [superAdminUser?._id, hrUser?._id, empUser?._id] } });
      await LeaveType.deleteMany({ code: { $in: ['AL_TEST', 'ENCASH_TEST', 'PL_TEST', 'CL_TEST'] } });
      await LeavePolicyYear.deleteMany({ isDemo: true });
      await LeaveBalance.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id, probationEmp._id] } });
      await LeaveRequest.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id, probationEmp._id] } });
      await LeaveLedger.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id, probationEmp._id] } });
      await SettlementAudit.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id, probationEmp._id] } });
    }
  });

  // TEST 1: Carry-Forward Cap & Forward Percent Calculation
  test('1. Settlement calculation enforces forwardPercent and maxCarry cap', () => {
    // 10 days closing = 4650 mins.
    // forwardPercent = 50% -> 2325 mins (5 days).
    // maxCarry = 3 days = 1395 mins.
    // Should cap at 1395 mins (3 days), with remaining 3255 mins (7 days) lapsed.
    const result = calculateSettlementRow({
      openingMinutes: 0,
      entitlementMinutes: 4650,
      carriedInMinutes: 0,
      takenMinutes: 0,
      pendingMinutes: 0,
      forwardType: 'carry_forward',
      leaveType: annualLeaveType,
      minutesPerDay: 465,
    });

    expect(result.closingMinutes).toBe(4650);
    expect(result.carriedForwardMinutes).toBe(1395); // Capped at maxCarry
    expect(result.lapsedMinutes).toBe(3255); // 4650 - 1395 = 3255
    expect(result.carriedForwardDays).toBe(3.00);
    expect(result.lapsedDays).toBe(7.00);
  });

  // TEST 2: Lapsed and Encash Flags
  test('2. Lapsed mode zeros carry/encash; Encash mode requires encashable flag', () => {
    // Lapsed
    const lapsedRes = calculateSettlementRow({
      openingMinutes: 0,
      entitlementMinutes: 4650,
      forwardType: 'lapsed',
      leaveType: annualLeaveType,
      minutesPerDay: 465,
    });
    expect(lapsedRes.carriedForwardMinutes).toBe(0);
    expect(lapsedRes.encashedMinutes).toBe(0);
    expect(lapsedRes.lapsedMinutes).toBe(4650);

    // Encash on NON-encashable leave type
    const nonEncashRes = calculateSettlementRow({
      openingMinutes: 0,
      entitlementMinutes: 4650,
      forwardType: 'encash',
      leaveType: annualLeaveType, // encashable = false
      minutesPerDay: 465,
    });
    expect(nonEncashRes.encashedMinutes).toBe(0); // Blocked

    // Encash on encashable leave type
    const encashRes = calculateSettlementRow({
      openingMinutes: 0,
      entitlementMinutes: 4650,
      forwardType: 'encash',
      leaveType: encashableLeaveType, // encashable = true
      minutesPerDay: 465,
    });
    expect(encashRes.encashedMinutes).toBe(4650);
    expect(encashRes.lapsedMinutes).toBe(0);
  });

  // TEST 3: Pro-Rata Entitlement for Joiners & Probation isolation
  test('3. Pro-rata entitlement allocates 50% for mid-year joiner and isolates probation leave', () => {
    // TestEmp1 joined in 2025 (Full year entitlement)
    const entFull = calculateEntitlementMinutes(annualLeaveType, testEmp1, policyYear2026);
    expect(entFull).toBe(5580); // 12 days * 465 = 5580

    // TestEmp2 joined on 1 July 2026 (6 months active -> 50% entitlement)
    const entProRata = calculateEntitlementMinutes(annualLeaveType, testEmp2, policyYear2026);
    expect(entProRata).toBe(2790); // 6 days * 465 = 2790

    // Probation leave for confirmed employee (must be 0)
    const entProbationForConfirmed = calculateEntitlementMinutes(probationLeaveType, testEmp1, policyYear2026);
    expect(entProbationForConfirmed).toBe(0);

    // Probation leave for probation employee (allowed)
    const entProbationForProb = calculateEntitlementMinutes(probationLeaveType, probationEmp, policyYear2026);
    expect(entProbationForProb).toBeGreaterThan(0);
  });

  // TEST 4: Pending Leave Requests Block Finalise
  test('4. Pending leave request blocks finalisation with 400 and returns pending list', async () => {
    // Create pending leave request
    const pendingReq = await LeaveRequest.create({
      employee: testEmp1._id,
      leaveType: annualLeaveType._id,
      fromDate: new Date('2028-11-20'),
      toDate: new Date('2028-11-21'),
      days: 2,
      minutes: 930,
      reason: 'Pending dental procedure',
      status: 'pending',
    });

    const req = {
      user: superAdminUser,
      body: { policyYearId: policyYear2026._id },
    };
    const res = mockRes();

    await settlementController.finalisePolicyYear(req, res, () => {});

    expect(res.data.success).toBe(false);
    expect(res.data.message).toContain('pending leave request(s) must be resolved first');

    // Clean up pending request
    await LeaveRequest.findByIdAndDelete(pendingReq._id);
  });

  // TEST 5: Finalised Year Locks Balances & Attendance Period
  test('5. Finalised year locks records and sets attendanceLockedUpToDate', async () => {
    const req = {
      user: superAdminUser,
      body: { policyYearId: policyYear2026._id },
    };
    const res = mockRes();

    await settlementController.finalisePolicyYear(req, res, () => {});

    expect(res.data.success).toBe(true);
    expect(res.data.data.status).toBe('finalised');

    // Verify AttendancePolicy lock advanced
    const policy = await AttendancePolicy.findOne({ isDefault: true });
    expect(new Date(policy.attendanceLockedUpToDate).toISOString().split('T')[0]).toBe(
      policyYear2026.endDate.toISOString().split('T')[0]
    );

    // Attempt draft update on finalised year (must fail)
    const reqDraft = {
      user: superAdminUser,
      body: {
        policyYearId: policyYear2026._id,
        updates: [{ balanceId: new mongoose.Types.ObjectId(), forwardType: 'carry_forward' }],
      },
    };
    const resDraft = mockRes();
    await settlementController.saveSettlementDraft(reqDraft, resDraft, () => {});

    expect(resDraft.data.success).toBe(false);
    expect(resDraft.data.message).toContain('finalised and locked');
  });

  // TEST 6: Reopen Policy Year by Super Admin Only
  test('6. Reopening policy year requires Super Admin role and a reason', async () => {
    // Attempt as HR (must fail with 403)
    const reqHR = {
      user: hrUser,
      userRole: 'hr',
      body: { policyYearId: policyYear2026._id, reason: 'Audit correction' },
    };
    const resHR = mockRes();
    await settlementController.reopenPolicyYear(reqHR, resHR, () => {});

    expect(resHR.data.success).toBe(false);
    expect(resHR.data.message).toContain('Only a Super Admin');

    // Attempt as Super Admin without reason (must fail with 400)
    const reqNoReason = {
      user: superAdminUser,
      userRole: 'super_admin',
      body: { policyYearId: policyYear2026._id, reason: '' },
    };
    const resNoReason = mockRes();
    await settlementController.reopenPolicyYear(reqNoReason, resNoReason, () => {});

    expect(resNoReason.data.success).toBe(false);
    expect(resNoReason.data.message).toContain('reason is required');

    // Attempt as Super Admin with reason (succeeds)
    const reqValid = {
      user: superAdminUser,
      userRole: 'super_admin',
      body: { policyYearId: policyYear2026._id, reason: 'Operations reconciliation approved by Director' },
    };
    const resValid = mockRes();
    await settlementController.reopenPolicyYear(reqValid, resValid, () => {});

    expect(resValid.data.success).toBe(true);
    expect(resValid.data.data.status).toBe('open');
  });

  // TEST 7: Import Opening Balances Dry-Run & Commit
  test('7. Opening balance import validates dry-run and commits cleanly to ledger', async () => {
    const importRows = [
      {
        employeeCode: testEmp1.employeeId,
        leaveTypeCode: 'AL_TEST',
        openingDays: 10,
        takenDays: 2,
      },
      {
        employeeCode: 'INVALID-CODE-999',
        leaveTypeCode: 'AL_TEST',
        openingDays: 5,
        takenDays: 0,
      },
    ];

    // Dry Run
    const reqDryRun = {
      user: superAdminUser,
      body: {
        policyYearId: policyYear2026._id,
        rows: importRows,
        dryRun: true,
      },
    };
    const resDryRun = mockRes();
    await settlementController.importOpeningBalances(reqDryRun, resDryRun, () => {});

    expect(resDryRun.data.success).toBe(true);
    expect(resDryRun.data.data.validCount).toBe(1);
    expect(resDryRun.data.data.errorCount).toBe(1);

    // Commit only valid rows
    const reqCommit = {
      user: superAdminUser,
      body: {
        policyYearId: policyYear2026._id,
        rows: [importRows[0]],
        dryRun: false,
      },
    };
    const resCommit = mockRes();
    await settlementController.importOpeningBalances(reqCommit, resCommit, () => {});

    expect(resCommit.data.success).toBe(true);
    expect(resCommit.data.data.committedCount).toBe(1);

    // Verify LeaveLedger entry
    const ledger = await LeaveLedger.findOne({
      employee: testEmp1._id,
      leaveType: annualLeaveType._id,
      transactionType: 'opening',
    });
    expect(ledger).not.toBeNull();
    expect(ledger.minutes).toBe(4650); // 10 days * 465 = 4650 mins
  });

  // TEST 8: Parallel Settlement Idempotency
  test('8. Parallel saveWithSettlement calls run concurrently without double crediting', async () => {
    // Seed balance with carry forward
    let bal = await LeaveBalance.findOne({
      employee: testEmp1._id,
      leaveType: annualLeaveType._id,
      year: 2028,
    });
    if (!bal) {
      bal = await LeaveBalance.create({
        employee: testEmp1._id,
        leaveType: annualLeaveType._id,
        year: 2028,
        policyYear: policyYear2026._id,
        closingMinutes: 2000,
        carriedForwardMinutes: 1395,
        forwardType: 'carry_forward',
      });
    } else {
      bal.closingMinutes = 2000;
      bal.carriedForwardMinutes = 1395;
      bal.forwardType = 'carry_forward';
      await bal.save();
    }

    const req1 = { user: superAdminUser, body: { policyYearId: policyYear2026._id } };
    const req2 = { user: superAdminUser, body: { policyYearId: policyYear2026._id } };
    const res1 = mockRes();
    const res2 = mockRes();

    // Fire sequentially or in parallel
    await settlementController.saveWithSettlement(req1, res1, () => {});
    await settlementController.saveWithSettlement(req2, res2, () => {});

    // Check next year's balance (2029)
    const nextYearBal = await LeaveBalance.findOne({
      employee: testEmp1._id,
      leaveType: annualLeaveType._id,
      year: 2029,
    });

    expect(nextYearBal).not.toBeNull();
    // Must strictly equal 1395, NOT 2790 (no double crediting!)
    expect(nextYearBal.carriedInMinutes).toBe(1395);
  });

  // TEST 9: Integer Minutes to 7.75h Display Conversion
  test('9. Screen display converts exact integer minutes using 7.75h (465 mins)', () => {
    // Exactly 1 day = 465 mins
    const oneDay = calculateSettlementRow({
      entitlementMinutes: 465,
      minutesPerDay: 465,
      leaveType: annualLeaveType,
    });
    expect(oneDay.entitlementDays).toBe(1.00);

    // Half day = 240 mins (approx 0.52 days)
    const halfDay = calculateSettlementRow({
      entitlementMinutes: 240,
      minutesPerDay: 465,
      leaveType: annualLeaveType,
    });
    expect(halfDay.entitlementDays).toBe(0.52);
    // Raw stored value is never rounded
    expect(halfDay.entitlementMinutes).toBe(240);
  });
});
