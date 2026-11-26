import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { AttendancePolicy, DEFAULT_UNVERIFIED_SETTINGS } from '../src/models/AttendancePolicy.js';
import { Shift } from '../src/models/Shift.js';
import { AttendanceLog } from '../src/models/AttendanceLog.js';
import { Attendance } from '../src/models/Attendance.js';
import { Employee } from '../src/models/Employee.js';
import { Department } from '../src/models/Department.js';
import { Holiday } from '../src/models/Holiday.js';
import { LeaveType } from '../src/models/LeaveType.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import { LeaveBalance } from '../src/models/LeaveBalance.js';
import { LeavePolicyYear } from '../src/models/LeavePolicyYear.js';
import { RemoteWorkRequest } from '../src/models/RemoteWorkRequest.js';
import { AttendanceRegularization } from '../src/models/AttendanceRegularization.js';
import { LatePenaltyRecord } from '../src/models/LatePenaltyRecord.js';
import { CriticalDate } from '../src/models/CriticalDate.js';
import { CompOffRequest } from '../src/models/CompOffRequest.js';
import { CompOffCredit } from '../src/models/CompOffCredit.js';
import { LeaveLedger } from '../src/models/LeaveLedger.js';
import { Role } from '../src/models/Role.js';
import {
  calculateDayStatus,
  getCompanyPolicy,
  getEmployeeMonthlyLateCount,
  syncLatePenaltyForDay,
} from '../src/services/dayStatus.service.js';
import {
  executeMonthlyLeaveAccrual,
  isEmployeeEligibleForAccrual,
  calculateServiceMonths,
} from '../src/services/leaveAccrual.service.js';
import * as requestsController from '../src/controllers/requests.controller.js';
import * as ruleBookController from '../src/controllers/ruleBookPolicy.controller.js';
import { handleWorkflowCompletion } from '../src/services/approvalHandlers.js';
import { runMissingClockOutInspection, runDailyEODReconciliation } from '../src/services/cron.service.js';
import { sendEmail } from '../src/utils/mailer.js';

describe('OFFICIAL ATTENDANCE & LEAVE RULE BOOK TEST SUITE', () => {
  let testDept, testEmp1, testEmp2, testProbationer;
  let casualLeaveType, annualLeaveType, sickLeaveType, compOffLeaveType;
  let hrUser, employeeUser, superAdminUser;

  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockImplementation((d) => {
      res.data = d;
      return res;
    });
    return res;
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    testDept = await Department.findOne({ code: 'RULEBOOK_DEPT' });
    if (!testDept) {
      testDept = await Department.create({ name: 'Rule Book Testing Dept', code: 'RULEBOOK_DEPT' });
    }

    // Clean up any test employee records
    await Employee.deleteMany({ employeeId: /^RB-TEST-/ });
    await AttendanceLog.deleteMany({ date: /^2026-03-/ });
    await LatePenaltyRecord.deleteMany({ dateStr: /^2026-03-/ });
    await CriticalDate.deleteMany({ title: /^Test Milestone/ });
    await AttendanceRegularization.deleteMany({ reason: /Biometric|Power|Forgot/ });
    await LeaveLedger.deleteMany({ memo: /^ACCRUAL_/ });
    await CompOffCredit.deleteMany({});

    // Confirmed employee with > 6 months service
    testEmp1 = await Employee.create({
      employeeId: 'RB-TEST-001',
      status: 'active',
      personal: {
        firstName: 'Sunil',
        lastName: 'Pradhan',
        officialEmail: 'sunil.rb1@illusorydesignstudios.com',
        phone: '9876543210',
        gender: 'Male',
      },
      employment: {
        department: testDept._id,
        designation: 'Senior 3D Artist',
        employmentType: 'full_time',
        status: 'active',
        dateOfJoining: new Date('2025-06-01'),
        joiningDate: new Date('2025-06-01'), // > 6 months
        confirmationDate: new Date('2025-12-01'),
      },
    });

    // Recently joined employee (< 6 months service, joined 10th Jan 2026)
    testEmp2 = await Employee.create({
      employeeId: 'RB-TEST-002',
      status: 'active',
      personal: {
        firstName: 'Pooja',
        lastName: 'Nayak',
        officialEmail: 'pooja.rb2@illusorydesignstudios.com',
        phone: '9876543211',
        gender: 'Female',
      },
      employment: {
        department: testDept._id,
        designation: 'UI Designer',
        employmentType: 'full_time',
        status: 'active',
        dateOfJoining: new Date('2026-01-10'),
        joiningDate: new Date('2026-01-10'), // < 6 months in March 2026
      },
    });

    // Employee on probation
    testProbationer = await Employee.create({
      employeeId: 'RB-TEST-003',
      status: 'probation',
      personal: {
        firstName: 'Bikash',
        lastName: 'Rout',
        officialEmail: 'bikash.rb3@illusorydesignstudios.com',
        phone: '9876543212',
        gender: 'Male',
      },
      employment: {
        department: testDept._id,
        designation: 'Motion Designer Intern',
        employmentType: 'full_time',
        status: 'probation',
        dateOfJoining: new Date('2026-02-18'),
        joiningDate: new Date('2026-02-18'), // Joined after 15th
      },
    });

    // Bootstrap standard leave types
    casualLeaveType = await LeaveType.findOneAndUpdate(
      { code: 'CL' },
      { name: 'Casual Leave', code: 'CL', yearlyQuota: 12, accrualMode: 'monthly', paid: true, isActive: true },
      { upsert: true, new: true }
    );

    annualLeaveType = await LeaveType.findOneAndUpdate(
      { code: 'AL' },
      { name: 'Annual Leave', code: 'AL', yearlyQuota: 12, accrualMode: 'monthly', paid: true, isActive: true },
      { upsert: true, new: true }
    );

    sickLeaveType = await LeaveType.findOneAndUpdate(
      { code: 'SL' },
      { name: 'Sick Leave', code: 'SL', yearlyQuota: 6, accrualMode: 'upfront', paid: true, isActive: true },
      { upsert: true, new: true }
    );

    compOffLeaveType = await LeaveType.findOneAndUpdate(
      { code: 'COMP_OFF' },
      { name: 'Comp-Off', code: 'COMP_OFF', yearlyQuota: 0, paid: true, isActive: true },
      { upsert: true, new: true }
    );

    hrUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'hr@illusorydesignstudios.com',
      role: 'hr',
      userRole: 'hr',
      employee: testEmp1,
    };

    employeeUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'sunil.rb1@illusorydesignstudios.com',
      role: 'employee',
      userRole: 'employee',
      employee: testEmp1,
    };

    superAdminUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'admin@illusorydesignstudios.com',
      role: 'super_admin',
      userRole: 'super_admin',
      employee: testEmp1,
    };
  });

  afterAll(async () => {
    await Employee.deleteMany({ employeeId: /^RB-TEST-/ });
    await AttendanceLog.deleteMany({ date: /^2026-03-/ });
    await LatePenaltyRecord.deleteMany({ dateStr: /^2026-03-/ });
    await CriticalDate.deleteMany({ title: /^Test Milestone/ });
    await AttendanceRegularization.deleteMany({ reason: /Biometric|Power|Forgot/ });
    await LeaveLedger.deleteMany({ memo: /^ACCRUAL_/ });
    await CompOffCredit.deleteMany({});
  });

  describe('1. Half-Day Rules & Day Status Precedence Hierarchy', () => {
    test('Precedence 1: Full-day approved leave overrides punches and sets status to LEAVE', async () => {
      const dateStr = '2026-03-02'; // Monday
      const leave = await LeaveRequest.create({
        employee: testEmp1._id,
        leaveType: casualLeaveType._id,
        fromDate: new Date(`${dateStr}T00:00:00.000Z`),
        toDate: new Date(`${dateStr}T23:59:59.999Z`),
        days: 1,
        minutes: 465,
        reason: 'Family event',
        status: 'approved',
      });

      // Add a punch on the same day
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`), // 10:00 AM IST
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LEAVE');
      expect(dayStatus.workedMinutes).toBe(0);

      // Cleanup
      await LeaveRequest.deleteOne({ _id: leave._id });
      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Table Case 1: in 10:00 out 18:45 -> LOG_OK', async () => {
      const dateStr = '2026-03-10'; // Tuesday
      // 10:00 AM IST = 04:30 UTC, 18:45 IST = 13:15 UTC
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T13:15:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LOG_OK');
      expect(dayStatus.isEarlyExit).toBe(false);
      expect(dayStatus.isLate).toBe(false);

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Table Case 2: out 18:44 -> LOG_OK', async () => {
      const dateStr = '2026-03-10';
      // in 10:00 AM IST (04:30 UTC), out 18:44 IST (13:14 UTC)
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T13:14:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LOG_OK');
      expect(dayStatus.isEarlyExit).toBe(false);

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Table Case 3: out 18:35 -> LOG_OK', async () => {
      const dateStr = '2026-03-10';
      // in 10:00 AM IST (04:30 UTC), out 18:35 IST (13:05 UTC)
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T13:05:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LOG_OK');
      expect(dayStatus.isEarlyExit).toBe(false);

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Table Case 4: out 18:15 -> LOG_OK plus EARLY_EXIT chip', async () => {
      const dateStr = '2026-03-10';
      // in 10:00 AM IST (04:30 UTC), out 18:15 IST (12:45 UTC)
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T12:45:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LOG_OK');
      expect(dayStatus.isEarlyExit).toBe(true);
      expect(dayStatus.chips.some((c) => c.key === 'EARLY_EXIT')).toBe(true);

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Table Case 5: out 17:50 -> HALF_DAY', async () => {
      const dateStr = '2026-03-10';
      // in 10:00 AM IST (04:30 UTC), out 17:50 IST (12:20 UTC)
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T12:20:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('HALF_DAY');

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Conflict Test: Works 310 min (>= 240m) but leaves before 18:00 (17:30 IST) -> MUST result in HALF_DAY', async () => {
      const dateStr = '2026-03-10'; // Tuesday (Non-holiday)
      // 11:20 AM IST = 05:50 UTC, 17:30 IST = 12:00 UTC
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T05:50:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T12:00:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('HALF_DAY');

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Table Case 6: in 10:20 out 18:45 -> LOG_OK plus one late entry and no half day', async () => {
      const dateStr = '2026-03-10';
      // in 10:20 AM IST (04:50 UTC), out 18:45 IST (13:15 UTC)
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:50:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T13:15:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LOG_OK');
      expect(dayStatus.isLate).toBe(true);
      expect(dayStatus.lateMinutes).toBe(20);
      expect(dayStatus.status).not.toBe('HALF_DAY');

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Undefined Pattern: Arrived after 14:00 (14:15 IST) without approved leave -> LOG_ERROR with needsHrReview flag', async () => {
      const dateStr = '2026-03-10';
      // in 14:15 IST (08:45 UTC), out 18:45 IST (13:15 UTC)
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T08:45:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T13:15:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LOG_ERROR');
      expect(dayStatus.needsHrReview).toBe(true);
      expect(dayStatus.reviewReason).toContain('without approved leave');

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Holiday Punch: Punching on Holiday (2026-03-03 Holi) -> WORKED_WEEK_OFF_OR_HOLIDAY and overtime = 0', async () => {
      const dateStr = '2026-03-03'; // Holi
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`), // 10:00 AM IST
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T13:15:00.000Z`), // 18:45 IST
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('WORKED_WEEK_OFF_OR_HOLIDAY');
      expect(dayStatus.overtimeMinutes).toBe(0); // Zero automatic overtime
      expect(dayStatus.chips.some((c) => c.key === 'COMP_OFF_PENDING')).toBe(true);

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Sunday Punch: Punching on Week-Off (2026-03-08 Sunday) -> WORKED_WEEK_OFF_OR_HOLIDAY and overtime = 0', async () => {
      const dateStr = '2026-03-08'; // Sunday
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T04:30:00.000Z`),
      });
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'out',
        time: new Date(`${dateStr}T13:15:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('WORKED_WEEK_OFF_OR_HOLIDAY');
      expect(dayStatus.overtimeMinutes).toBe(0); // Zero automatic overtime
      expect(dayStatus.chips.some((c) => c.key === 'COMP_OFF_PENDING')).toBe(true);

      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('First-Half Leave Cut-off: Arriving after 2:00 PM (14:15 IST) counts as Full-Day Leave', async () => {
      const dateStr = '2026-03-06'; // Friday
      const halfLeave = await LeaveRequest.create({
        employee: testEmp1._id,
        leaveType: casualLeaveType._id,
        fromDate: new Date(`${dateStr}T00:00:00.000Z`),
        toDate: new Date(`${dateStr}T23:59:59.999Z`),
        isHalfDay: true,
        days: 0.5,
        minutes: 240,
        reason: 'Morning personal work',
        status: 'approved',
      });

      // Arrives at 2:15 PM IST (08:45 UTC) -> past 2:00 PM cut-off
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T08:45:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.status).toBe('LEAVE'); // Treated as full-day leave

      await LeaveRequest.deleteOne({ _id: halfLeave._id });
      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });
  });

  describe('2. Late-Entry Counter, Exemptions & Review Modes', () => {
    test('Rule 5 Exemption: Punch-in after 10:00 AM on approved remote work day MUST NOT count as late', async () => {
      const dateStr = '2026-03-09'; // Monday
      const rw = await RemoteWorkRequest.create({
        employee: testEmp1._id,
        fromDate: new Date(`${dateStr}T00:00:00.000Z`),
        toDate: new Date(`${dateStr}T23:59:59.999Z`),
        reason: 'Client meeting remote',
        status: 'approved',
      });

      // Clock in at 10:35 AM IST (after 10:00 AM)
      await AttendanceLog.create({
        employee: testEmp1._id,
        date: dateStr,
        type: 'in',
        time: new Date(`${dateStr}T05:05:00.000Z`),
      });

      const dayStatus = await calculateDayStatus(testEmp1._id, dateStr);
      expect(dayStatus.isLate).toBe(false);
      expect(dayStatus.lateMinutes).toBe(0);

      await RemoteWorkRequest.deleteOne({ _id: rw._id });
      await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    });

    test('Late Counter & Deduction Tiers: Entry 1-2 monitoring, 3-4 half-day, 5+ full-day', async () => {
      const policy = await getCompanyPolicy();
      policy.automationEnabled = true;

      // Record 5 late entries
      const dates = ['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14'];
      const records = [];

      for (let i = 0; i < dates.length; i++) {
        const checkIn = new Date(`${dates[i]}T05:00:00.000Z`); // 10:30 AM IST (30m late)
        const rec = await syncLatePenaltyForDay(testEmp1._id, dates[i], checkIn, 30, policy);
        records.push(rec);
      }

      // Entry 1 & 2 -> 'none' (monitoring only)
      expect(records[0].deductionTier).toBe('none');
      expect(records[1].deductionTier).toBe('none');

      // Entry 3 & 4 -> 'half_day'
      expect(records[2].deductionTier).toBe('half_day');
      expect(records[3].deductionTier).toBe('half_day');

      // Entry 5 -> 'full_day'
      expect(records[4].deductionTier).toBe('full_day');

      // Default mode: all have status 'pending_hr_review' (zero automatic deduction)
      records.forEach((r) => {
        expect(r.status).toBe('pending_hr_review');
        expect(r.penaltyMode).toBe('flag_for_review');
      });
    });

    test('HR can waive late penalty with mandatory reason, marking it excused', async () => {
      const penalty = await LatePenaltyRecord.findOne({ employee: testEmp1._id, dateStr: '2026-03-12' });
      expect(penalty).toBeTruthy();

      const req = {
        user: hrUser,
        params: { id: penalty._id },
        body: {
          action: 'waive',
          reason: 'Severe traffic disruption due to city marathon confirmed by HR',
        },
      };
      const res = mockRes();

      await ruleBookController.actOnLatePenalty(req, res, (err) => {
        throw err;
      });

      expect(res.data.success).toBe(true);
      expect(res.data.data.status).toBe('waived');
      expect(res.data.data.isExcused).toBe(true);
      expect(res.data.data.reviewReason).toContain('Severe traffic disruption');
    });
  });

  describe('3. Regularization Limits & Exception Path', () => {
    test('Allows up to 2 regularizations in a calendar month, but 3rd requires exception path', async () => {
      await AttendanceRegularization.deleteMany({ employee: testEmp1._id });

      const d1 = new Date(); d1.setDate(d1.getDate() - 5); const date1 = d1.toISOString().split('T')[0];
      const d2 = new Date(); d2.setDate(d2.getDate() - 4); const date2 = d2.toISOString().split('T')[0];
      const d3 = new Date(); d3.setDate(d3.getDate() - 3); const date3 = d3.toISOString().split('T')[0];

      // 1st regularization
      const req1 = {
        user: employeeUser,
        body: { date: date1, punchType: 'in', reason: 'Biometric device lag' },
      };
      const res1 = mockRes();
      await requestsController.applyRegularizationRequest(req1, res1, (e) => { throw e; });
      expect(res1.data.success).toBe(true);

      // 2nd regularization
      const req2 = {
        user: employeeUser,
        body: { date: date2, punchType: 'in', reason: 'Power fluctuation at studio' },
      };
      const res2 = mockRes();
      await requestsController.applyRegularizationRequest(req2, res2, (e) => { throw e; });
      expect(res2.data.success).toBe(true);

      // 3rd regularization without isException -> BLOCKED
      const req3 = {
        user: employeeUser,
        body: { date: date3, punchType: 'in', reason: 'Forgot card' },
      };
      const res3 = mockRes();
      await requestsController.applyRegularizationRequest(req3, res3, (e) => { throw e; });
      expect(res3.status).toHaveBeenCalledWith(400);
      expect(res3.data.message).toContain('reached the monthly limit of 2 regularizations');

      // 3rd regularization with isException: true -> ALLOWED as Exception
      const req3Exception = {
        user: employeeUser,
        body: { date: date3, punchType: 'in', reason: 'Forgot card', isException: true },
      };
      const res3Exception = mockRes();
      await requestsController.applyRegularizationRequest(req3Exception, res3Exception, (e) => { throw e; });
      expect(res3Exception.data.success).toBe(true);
      expect(res3Exception.data.data.isException).toBe(true);
    });
  });

  describe('4. Monthly Leave Accrual & Idempotency', () => {
    test('Accrual is idempotent: running twice in the same month never double-credits', async () => {
      const year = 2026;
      const month = 3;
      await LeaveLedger.deleteMany({ memo: `ACCRUAL_${year}_M${String(month).padStart(2, '0')}` });

      const testPolicy = {
        automationEnabled: true,
        accrualStartRule: 'from_joining_month',
        accrualProrateFirstMonth: true,
        accrueDuringProbation: false,
      };

      const run1 = await executeMonthlyLeaveAccrual({ year, month, overridePolicy: testPolicy });
      expect(run1.credited).toBeGreaterThan(0);

      const run2 = await executeMonthlyLeaveAccrual({ year, month, overridePolicy: testPolicy });
      // On second execution, all eligible employees should be skipped as already accrued
      expect(run2.credited).toBe(0);
      expect(run2.skippedAlreadyAccrued).toBeGreaterThan(0);
    });

    test('Annual Leave eligibility barrier: Employee with < 6 months service is ineligible', () => {
      const policy = { minServiceMonths: 6, minServiceFrom: 'joining', accrueDuringProbation: false };

      // testEmp2 joined Jan 10, 2026 -> In March 2026, service is ~2 months (< 6 months)
      const res = isEmployeeEligibleForAccrual({
        employee: testEmp2,
        leaveType: annualLeaveType,
        year: 2026,
        month: 3,
        policy,
      });

      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('Annual Leave requires 6 months continuous service');
    });

    test('Accrual during probation is disabled by default', () => {
      const policy = { accrueDuringProbation: false, accrualStartRule: 'from_joining_month' };

      const res = isEmployeeEligibleForAccrual({
        employee: testProbationer,
        leaveType: casualLeaveType,
        year: 2026,
        month: 3,
        policy,
      });

      expect(res.eligible).toBe(false);
      expect(res.reason).toContain('Accrual during probation is disabled in policy');
    });
  });

  describe('5. Leave Notice Rules & Emergency Flags', () => {
    test('Casual Leave requested with < 24h notice without emergency flag is rejected', async () => {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 10); // 10h notice

      const req = {
        user: employeeUser,
        body: {
          leaveTypeId: casualLeaveType._id,
          fromDate: tomorrow.toISOString().split('T')[0],
          toDate: tomorrow.toISOString().split('T')[0],
          reason: 'Personal work',
          isEmergency: false,
        },
      };
      const res = mockRes();

      await requestsController.applyLeaveRequest(req, res, (e) => { throw e; });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data.message).toContain('Casual Leave requires at least 24 hours advance notice');
    });

    test('Casual Leave with < 24h notice is accepted if flagged as genuine emergency', async () => {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 10);

      // Create opening balance
      await LeaveBalance.findOneAndUpdate(
        { employee: testEmp1._id, leaveType: casualLeaveType._id, year: tomorrow.getFullYear() },
        { allocated: 10, used: 0, pending: 0 },
        { upsert: true }
      );

      const req = {
        user: employeeUser,
        body: {
          leaveTypeId: casualLeaveType._id,
          fromDate: tomorrow.toISOString().split('T')[0],
          toDate: tomorrow.toISOString().split('T')[0],
          reason: 'Family medical emergency',
          isEmergency: true,
        },
      };
      const res = mockRes();

      await requestsController.applyLeaveRequest(req, res, (e) => { throw e; });
      expect(res.data.success).toBe(true);
      expect(res.data.data.isEmergency).toBe(true);
    });

    test('Sick Leave for 2+ consecutive days without medical document sets status to proof_pending with 48h deadline', async () => {
      const from = new Date('2026-03-23');
      const to = new Date('2026-03-25'); // 3 days

      await LeaveBalance.findOneAndUpdate(
        { employee: testEmp1._id, leaveType: sickLeaveType._id, year: 2026 },
        { allocated: 6, used: 0, pending: 0 },
        { upsert: true }
      );

      const req = {
        user: employeeUser,
        body: {
          leaveTypeId: sickLeaveType._id,
          fromDate: '2026-03-23',
          toDate: '2026-03-25',
          reason: 'Viral fever and rest',
        },
      };
      const res = mockRes();

      await requestsController.applyLeaveRequest(req, res, (e) => { throw e; });
      expect(res.data.success).toBe(true);
      expect(res.data.data.proofStatus).toBe('proof_pending');
      expect(res.data.data.proofDeadline).toBeDefined();
    });
  });

  describe('6. Critical Dates Advisory Warning & Unauthorized Absence', () => {
    test('Leave applied on critical studio date returns advisory warning notice', async () => {
      await CriticalDate.create({
        title: 'Test Milestone Presentation',
        date: new Date('2026-03-27T00:00:00.000Z'),
        dateStr: '2026-03-27',
        type: 'client_milestone',
      });

      const req = {
        user: employeeUser,
        body: {
          leaveTypeId: casualLeaveType._id,
          fromDate: '2026-03-27',
          toDate: '2026-03-27',
          reason: 'Taking Friday off',
          isEmergency: true, // bypass notice
        },
      };
      const res = mockRes();

      await requestsController.applyLeaveRequest(req, res, (e) => { throw e; });
      expect(res.data.success).toBe(true);
      expect(res.data.message).toContain('Advisory Notice: Test Milestone Presentation');
    });

    test('Partial Day requests are blocked while partialDayEnabled feature flag is OFF', async () => {
      const req = {
        user: employeeUser,
        body: {
          date: '2026-03-24',
          type: 'late_coming',
          minutes: 60,
          reason: 'Doctor visit',
        },
      };
      const res = mockRes();

      await requestsController.applyPartialDayRequest(req, res, (e) => { throw e; });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.data.message).toContain('Hourly Partial Day leave is currently disabled');
    });

    test('Comp-Off Credit validity adheres to 30 days expiry per Rule Book', async () => {
      const workedDate = new Date('2026-03-01T00:00:00.000Z');
      const compReq = await CompOffRequest.create({
        employee: testEmp1._id,
        workedDate,
        creditMinutes: 465,
        creditDays: 1,
        reason: 'Worked on Sunday shoot',
        status: 'pending',
      });

      const approval = {
        type: 'comp_off',
        referenceModel: 'CompOffRequest',
        referenceId: compReq._id,
      };

      await handleWorkflowCompletion(approval, 'approved', hrUser);

      const credit = await CompOffCredit.findOne({ compOffRequest: compReq._id });
      expect(credit).toBeTruthy();

      const diffDays = Math.round((credit.expiresAt - credit.earnedDate) / (1000 * 60 * 60 * 24));
      // Rule Book requirement: 30 days expiry
      expect(diffDays).toBe(30);

      await CompOffRequest.deleteOne({ _id: compReq._id });
      await CompOffCredit.deleteOne({ _id: credit._id });
    });
  });

  describe('7. Go-Live Safety Switch & Automation Guard Tests', () => {
    test('Safety Switch OFF: executeMonthlyLeaveAccrual skips and modifies zero records', async () => {
      // Ensure database policy has automationEnabled = false
      const policy = await getCompanyPolicy();
      policy.automationEnabled = false;
      await policy.save();

      const res = await executeMonthlyLeaveAccrual({ year: 2026, month: 4 });
      expect(res.credited).toBe(0);
      expect(res.skippedAutomationOff).toBe(true);
      expect(res.reason).toContain('Automation is OFF');
    });

    test('Safety Switch OFF: syncLatePenaltyForDay returns null and saves zero records', async () => {
      const policy = await getCompanyPolicy();
      policy.automationEnabled = false;

      const checkIn = new Date('2026-04-10T05:00:00.000Z');
      const rec = await syncLatePenaltyForDay(testEmp1._id, '2026-04-10', checkIn, 30, policy);
      expect(rec).toBeNull();

      const inDb = await LatePenaltyRecord.findOne({ employee: testEmp1._id, dateStr: '2026-04-10' });
      expect(inDb).toBeNull();
    });

    test('Safety Switch OFF: runMissingClockOutInspection returns skipped count 0', async () => {
      const res = await runMissingClockOutInspection();
      expect(res.skipped).toBe(true);
      expect(res.count).toBe(0);
      expect(res.reason).toMatch(/Automation is OFF/i);
    });

    test('Safety Switch OFF: runDailyEODReconciliation returns skipped count 0', async () => {
      const res = await runDailyEODReconciliation();
      expect(res.skipped).toBe(true);
      expect(res.count).toBe(0);
      expect(res.reason).toMatch(/Automation is OFF/i);
    });

    test('Safety Switch OFF: Outbound email dispatcher skips email sending', async () => {
      const res = await sendEmail({
        to: 'test@illusorydesignstudios.com',
        subject: 'Go-Live Safety Test',
        text: 'Testing safety switch outbound block',
      });
      expect(res.skipped).toBe(true);
      expect(res.reason).toMatch(/Automation is OFF/i);
    });

    test('Master Switch API: Rejects non-super-admin user', async () => {
      const req = {
        user: hrUser, // HR user, not super_admin
        userRole: 'hr',
        body: { enabled: true, confirmationPhrase: 'ENABLE_AUTOMATION' },
      };
      const res = mockRes();

      await ruleBookController.toggleAutomationSwitch(req, res, (e) => { throw e; });
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.data.message).toMatch(/Only Super Admin/i);
    });

    test('Master Switch API: Rejects toggle without exact confirmation text', async () => {
      const req = {
        user: superAdminUser,
        userRole: 'super_admin',
        body: { enabled: true, confirmationPhrase: 'WRONG_PHRASE' },
      };
      const res = mockRes();

      await ruleBookController.toggleAutomationSwitch(req, res, (e) => { throw e; });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data.message).toMatch(/ENABLE_AUTOMATION/);
    });

    test('Master Switch API: Successfully toggles to ON when confirmed by super_admin', async () => {
      const req = {
        user: superAdminUser,
        userRole: 'super_admin',
        body: { enabled: true, confirmationPhrase: 'ENABLE_AUTOMATION' },
      };
      const res = mockRes();

      await ruleBookController.toggleAutomationSwitch(req, res, (e) => { throw e; });
      expect(res.data.success).toBe(true);
      expect(res.data.data.automationEnabled).toBe(true);

      // Re-disable to restore safety default OFF
      const reqOff = {
        user: superAdminUser,
        userRole: 'super_admin',
        body: { enabled: false },
      };
      const resOff = mockRes();
      await ruleBookController.toggleAutomationSwitch(reqOff, resOff, (e) => { throw e; });
      expect(resOff.data.data.automationEnabled).toBe(false);
    });
  });
});
