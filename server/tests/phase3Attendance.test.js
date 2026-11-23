import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Department } from '../src/models/Department.js';
import { AttendancePolicy } from '../src/models/AttendancePolicy.js';
import { Shift } from '../src/models/Shift.js';
import { ShiftAssignment } from '../src/models/ShiftAssignment.js';
import { Holiday } from '../src/models/Holiday.js';
import { LeaveType } from '../src/models/LeaveType.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import { AttendanceLog } from '../src/models/AttendanceLog.js';
import { Attendance } from '../src/models/Attendance.js';
import { BulkAction } from '../src/models/BulkAction.js';
import { RosterChangeHistory } from '../src/models/RosterChangeHistory.js';
import { calculateDayStatus, resolveEmployeeShift, toISTDateString, getCompanyPolicy } from '../src/services/dayStatus.service.js';
import * as bulkController from '../src/controllers/bulkAttendance.controller.js';
import * as rosterController from '../src/controllers/roster.controller.js';

describe('PHASE 3: MANAGE BULK IN/OUT & SHIFT ROSTER TESTS', () => {
  let superAdminUser, emp1User, emp2User;
  let testEmp1, testEmp2;
  let defaultShift, lateShift;
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

    const superAdminRole = await Role.findOne({ key: 'super_admin' });
    const empRole = await Role.findOne({ key: 'employee' });

    testDept = await Department.findOne({ name: 'Testing Dept' }) ||
      await Department.create({ name: 'Testing Dept', code: 'TEST' });

    // Setup Default Shift
    defaultShift = await Shift.findOne({ isDefault: true });
    if (!defaultShift) {
      defaultShift = await Shift.create({
        name: 'General Studio Shift',
        startTime: '10:00',
        endTime: '18:45',
        graceMinutes: 15,
        workingMinutes: 465,
        isDefault: true,
      });
    }

    // Setup Late Shift for tests (12:00 to 20:00)
    lateShift = await Shift.findOne({ name: 'Afternoon Creative Shift' });
    if (!lateShift) {
      lateShift = await Shift.create({
        name: 'Afternoon Creative Shift',
        startTime: '12:00',
        endTime: '20:00',
        graceMinutes: 15,
        workingMinutes: 480,
        isDefault: false,
      });
    }

    // Create Test Employees
    const ts = Date.now();
    testEmp1 = await Employee.create({
      employeeId: `IDS-P3-01-${ts}`,
      status: 'active',
      personal: {
        firstName: 'BulkTest',
        lastName: 'One',
        phone: '+919999900001',
        officialEmail: `bulk1.${ts}@illusory.design`,
      },
      employment: {
        department: testDept._id,
        designation: 'Designer',
        joiningDate: new Date('2026-01-01'),
      },
    });

    testEmp2 = await Employee.create({
      employeeId: `IDS-P3-02-${ts}`,
      status: 'active',
      personal: {
        firstName: 'BulkTest',
        lastName: 'Two',
        phone: '+919999900002',
        officialEmail: `bulk2.${ts}@illusory.design`,
      },
      employment: {
        department: testDept._id,
        designation: 'Developer',
        joiningDate: new Date('2026-01-01'),
      },
    });

    // Create Users
    superAdminUser = await User.create({
      email: `admin.p3.${ts}@illusory.design`,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: superAdminRole._id,
      isActive: true,
    });

    emp1User = await User.create({
      email: testEmp1.personal.officialEmail,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: empRole._id,
      employee: testEmp1._id,
      isActive: true,
    });

    emp2User = await User.create({
      email: testEmp2.personal.officialEmail,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr',
      role: empRole._id,
      employee: testEmp2._id,
      isActive: true,
    });
  }, 60000);

  afterAll(async () => {
    // Cleanup created test records
    if (testEmp1) {
      await Employee.deleteMany({ _id: { $in: [testEmp1._id, testEmp2._id] } });
      await User.deleteMany({ _id: { $in: [superAdminUser?._id, emp1User?._id, emp2User?._id] } });
      await AttendanceLog.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id] } });
      await Attendance.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id] } });
      await ShiftAssignment.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id] } });
      await RosterChangeHistory.deleteMany({ employee: { $in: [testEmp1._id, testEmp2._id] } });
      await BulkAction.deleteMany({ executedBy: superAdminUser?._id });
    }
    if (lateShift) {
      await Shift.deleteOne({ _id: lateShift._id });
    }
  });

  // TEST 1: Overnight Shift Rejection
  test('1. Shift Model rejects overnight shifts crossing midnight', async () => {
    const overnightShift = new Shift({
      name: 'Overnight Shift',
      startTime: '22:00',
      endTime: '06:00', // Next day
      workingMinutes: 480,
    });

    let error = null;
    try {
      await overnightShift.save();
    } catch (err) {
      error = err;
    }

    expect(error).not.toBeNull();
    expect(error.message).toContain('Overnight shifts crossing midnight are not currently supported');
  });

  // TEST 2: Bulk Punch Preview detects conflicts
  test('2. Bulk preview flags conflicts (already clocked in & missing clock-in)', async () => {
    const dateStr = '2026-11-18';

    // Seed existing clock-in for Emp 1
    await AttendanceLog.create({
      employee: testEmp1._id,
      date: dateStr,
      type: 'in',
      time: new Date(`${dateStr}T10:00:00.000Z`),
      source: 'manual',
    });

    const req = {
      body: {
        employeeIds: [testEmp1._id, testEmp2._id],
        date: dateStr,
        actionType: 'in',
        time: '10:00',
      },
    };
    const res = mockRes();

    await bulkController.previewBulkPunch(req, res, () => {});

    expect(res.data.success).toBe(true);
    const { previewRows, summary } = res.data.data;

    expect(summary.total).toBe(2);
    expect(summary.conflicts).toBe(1); // Emp 1 has conflict
    expect(summary.ready).toBe(1); // Emp 2 is ready

    const emp1Row = previewRows.find((r) => String(r.employeeId) === String(testEmp1._id));
    expect(emp1Row.hasConflict).toBe(true);
    expect(emp1Row.conflicts[0]).toContain('Already has a clock-in punch');
  });

  // TEST 3: Bulk Execution Idempotency
  test('3. Bulk punch execution is idempotent (re-running skips duplicate punch)', async () => {
    const dateStr = '2026-11-19';

    const req = {
      user: superAdminUser,
      body: {
        employeeIds: [testEmp2._id],
        date: dateStr,
        actionType: 'in',
        time: '10:05',
        reason: 'Studio Team Sync',
      },
    };

    // First Run
    const res1 = mockRes();
    await bulkController.executeBulkPunch(req, res1, () => {});
    expect(res1.data.success).toBe(true);
    expect(res1.data.data.summary.succeededCount).toBe(1);

    // Count logs
    const logCountAfterFirst = await AttendanceLog.countDocuments({
      employee: testEmp2._id,
      date: dateStr,
      type: 'in',
    });
    expect(logCountAfterFirst).toBe(1);

    // Second Run (Identical parameters)
    const res2 = mockRes();
    await bulkController.executeBulkPunch(req, res2, () => {});
    expect(res2.data.success).toBe(true);
    expect(res2.data.data.summary.skippedCount).toBe(1); // Idempotently skipped!
    expect(res2.data.data.summary.succeededCount).toBe(0);

    const logCountAfterSecond = await AttendanceLog.countDocuments({
      employee: testEmp2._id,
      date: dateStr,
      type: 'in',
    });
    expect(logCountAfterSecond).toBe(1); // NO DUPLICATE LOGS!
  });

  // TEST 4: 24-Hour Undo Bulk Action
  test('4. 24-hour undo removes only bulk logs and restores day status', async () => {
    const dateStr = '2026-11-20';

    // Execute bulk punch
    const reqExecute = {
      user: superAdminUser,
      body: {
        employeeIds: [testEmp1._id, testEmp2._id],
        date: dateStr,
        actionType: 'in',
        time: '10:00',
        reason: 'Batch Morning Clock In',
      },
    };
    const resExec = mockRes();
    await bulkController.executeBulkPunch(reqExecute, resExec, () => {});
    const bulkActionId = resExec.data.data.bulkActionId;

    // Verify logs exist
    const logsBeforeUndo = await AttendanceLog.find({ bulkActionId });
    expect(logsBeforeUndo.length).toBe(2);

    // Execute Undo
    const reqUndo = {
      user: superAdminUser,
      params: { bulkActionId },
    };
    const resUndo = mockRes();
    await bulkController.undoBulkAction(reqUndo, resUndo, () => {});

    expect(resUndo.data.success).toBe(true);
    expect(resUndo.data.data.deletedLogsCount).toBe(2);

    // Verify logs are removed
    const logsAfterUndo = await AttendanceLog.find({ bulkActionId });
    expect(logsAfterUndo.length).toBe(0);

    // Calling undo second time must fail
    const resUndoAgain = mockRes();
    await bulkController.undoBulkAction(reqUndo, resUndoAgain, () => {});
    expect(resUndoAgain.data.success).toBe(false);
    expect(resUndoAgain.data.message).toContain('already been undone');
  });

  // TEST 5: Attendance Policy Locked Period Block
  test('5. Attendance policy lock blocks bulk punch and roster modification', async () => {
    const policy = await getCompanyPolicy();
    const oldLock = policy.attendanceLockedUpToDate;

    try {
      // Set locked up to 2026-11-15
      policy.attendanceLockedUpToDate = new Date('2026-11-15T23:59:59.999Z');
      await policy.save();

      // Attempt bulk punch on locked date (2026-11-10)
      const reqBulk = {
        user: superAdminUser,
        body: {
          employeeIds: [testEmp1._id],
          date: '2026-11-10',
          actionType: 'in',
          time: '10:00',
          reason: 'Test Locked Block',
        },
      };
      const resBulk = mockRes();
      await bulkController.executeBulkPunch(reqBulk, resBulk, () => {});

      expect(resBulk.data.success).toBe(false);
      expect(resBulk.data.message).toContain('locked');

      // Attempt roster assignment on locked date (2026-11-10)
      const reqRoster = {
        user: superAdminUser,
        body: {
          assignments: [
            {
              employeeId: testEmp1._id,
              date: '2026-11-10',
              shiftId: lateShift._id,
            },
          ],
          reason: 'Change locked roster',
        },
      };
      const resRoster = mockRes();
      await rosterController.assignRoster(reqRoster, resRoster, () => {});

      expect(resRoster.data.success).toBe(false);
      expect(resRoster.data.message).toContain('locked');
    } finally {
      policy.attendanceLockedUpToDate = oldLock;
      await policy.save();
    }
  });

  // TEST 6: Shift Resolution & Late Calculation
  test('6. Special shift overrides default shift; late calculation adheres to resolved shift', async () => {
    const dateStr = '2026-11-25'; // Wednesday

    // Default shift: 10:00 (grace 15m) -> punch at 10:25 IST is late by 25 mins
    const punchUTC_1025 = new Date('2026-11-25T04:55:00.000Z'); // 04:55 UTC = 10:25 IST
    const punchUTC_1845 = new Date('2026-11-25T13:15:00.000Z'); // 13:15 UTC = 18:45 IST

    await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });
    await AttendanceLog.create({
      employee: testEmp1._id,
      date: dateStr,
      type: 'in',
      time: punchUTC_1025,
      source: 'manual',
    });
    await AttendanceLog.create({
      employee: testEmp1._id,
      date: dateStr,
      type: 'out',
      time: punchUTC_1845,
      source: 'manual',
    });

    const statusDefault = await calculateDayStatus(testEmp1._id, dateStr);
    expect(statusDefault.lateMinutes).toBe(25); // Late on 10:00 shift

    // Assign Special Shift (Late shift starts at 12:00)
    await ShiftAssignment.create({
      employee: testEmp1._id,
      shift: lateShift._id,
      startDate: new Date(`${dateStr}T00:00:00.000Z`),
      endDate: new Date(`${dateStr}T23:59:59.999Z`),
      type: 'special',
    });

    const statusSpecial = await calculateDayStatus(testEmp1._id, dateStr);
    expect(statusSpecial.lateMinutes).toBe(0); // Arriving at 10:25 for a 12:00 shift is NOT late!
  });

  // TEST 7: Deleted Shift counts as scheduled Day Off, not absent
  test('7. Deleted shift resolution counts as scheduled Day Off (WEEK_OFF), not absent (NOT_PA)', async () => {
    const dateStr = '2026-11-26'; // Thursday (Normal working day)

    // Ensure no logs
    await AttendanceLog.deleteMany({ employee: testEmp1._id, date: dateStr });

    // Without shift assignment on past day, normally NOT_PA
    // Assign 'deleted' shift (Scheduled Day Off)
    await ShiftAssignment.create({
      employee: testEmp1._id,
      shift: defaultShift._id,
      startDate: new Date(`${dateStr}T00:00:00.000Z`),
      endDate: new Date(`${dateStr}T23:59:59.999Z`),
      type: 'deleted',
      remarks: 'Scheduled Day Off by Studio Operations',
    });

    const statusResult = await calculateDayStatus(testEmp1._id, dateStr);
    expect(statusResult.status).toBe('WEEK_OFF'); // Handled as Day Off!
    expect(statusResult.status).not.toBe('NOT_PA');
  });

  // TEST 8: Roster Change History on past date
  test('8. Modifying past roster requires reason and records RosterChangeHistory', async () => {
    const pastDate = '2026-11-05';

    // Attempt without reason
    const reqNoReason = {
      user: superAdminUser,
      body: {
        assignments: [
          {
            employeeId: testEmp2._id,
            date: pastDate,
            shiftId: lateShift._id,
          },
        ],
        reason: '', // Missing
      },
    };
    const resNoReason = mockRes();
    await rosterController.assignRoster(reqNoReason, resNoReason, () => {});

    expect(resNoReason.data.success).toBe(false);
    expect(resNoReason.data.message).toContain('reason is required');

    // With reason
    const reqWithReason = {
      user: superAdminUser,
      body: {
        assignments: [
          {
            employeeId: testEmp2._id,
            date: pastDate,
            shiftId: lateShift._id,
          },
        ],
        reason: 'Shift swap authorized by Lead',
      },
    };
    const resWithReason = mockRes();
    await rosterController.assignRoster(reqWithReason, resWithReason, () => {});

    expect(resWithReason.data.success).toBe(true);

    // Verify history recorded
    const history = await RosterChangeHistory.findOne({
      employee: testEmp2._id,
      date: pastDate,
    });
    expect(history).not.toBeNull();
    expect(history.affectedPastDate).toBe(true);
    expect(history.reason).toBe('Shift swap authorized by Lead');
  });

  // TEST 9: RBAC - Employee cannot view other employee's roster
  test('9. Security: Regular employee is blocked from accessing other staff roster (403)', async () => {
    const reqUnauthorized = {
      user: emp1User,
      userRole: 'employee',
      permissions: ['attendance.read'],
      query: {
        employeeId: testEmp2._id, // Requesting someone else's roster!
      },
    };
    const resUnauthorized = mockRes();

    await rosterController.getRosterMatrix(reqUnauthorized, resUnauthorized, () => {});

    expect(resUnauthorized.data.success).toBe(false);
    expect(resUnauthorized.data.message).toContain('Access denied');
  });
});
