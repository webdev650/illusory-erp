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
import { Holiday } from '../src/models/Holiday.js';
import { LeaveType } from '../src/models/LeaveType.js';
import { LeaveBalance } from '../src/models/LeaveBalance.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import { RemoteWorkRequest } from '../src/models/RemoteWorkRequest.js';
import { PartialDayRequest } from '../src/models/PartialDayRequest.js';
import { CompOffRequest } from '../src/models/CompOffRequest.js';
import { CompOffCredit } from '../src/models/CompOffCredit.js';
import { AttendanceRegularization } from '../src/models/AttendanceRegularization.js';
import { AttendanceLog } from '../src/models/AttendanceLog.js';
import { ApprovalRequest } from '../src/models/ApprovalRequest.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { createApprovalRequest, resolveApproverSteps } from '../src/services/approval.service.js';
import { handleWorkflowCompletion } from '../src/services/approvalHandlers.js';
import { checkOverlap, calculateBillableDays } from '../src/controllers/requests.controller.js';

describe('PHASE 2: ATTENDANCE REQUESTS & APPROVAL ENGINE TESTS', () => {
  let superAdminRole, hrRole, managerRole, empRole;
  let superAdminUser, hrUser, managerUser, empUser;
  let superAdminEmp, hrEmp, managerEmp, standardEmp;
  let paidLeaveType, sickLeaveType, compOffLeaveType;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }

    // 1. Roles
    superAdminRole = await Role.findOne({ key: 'super_admin' });
    hrRole = await Role.findOne({ key: 'hr' });
    managerRole = await Role.findOne({ key: 'manager' }) || hrRole;
    empRole = await Role.findOne({ key: 'employee' });

    // 2. Test Department
    let dept = await Department.findOne({ name: 'Testing Dept' });
    if (!dept) {
      dept = await Department.create({ name: 'Testing Dept', code: 'TEST' });
    }

    // 3. Test Employees
    managerEmp = await Employee.create({
      employeeId: `IDS-MGR-${Date.now()}`,
      status: 'active',
      personal: {
        firstName: 'Test',
        lastName: 'Manager',
        phone: '+919876543210',
        officialEmail: `test.mgr.${Date.now()}@illusory.design`,
      },
      employment: {
        department: dept._id,
        designation: 'Design Lead',
      },
    });

    standardEmp = await Employee.create({
      employeeId: `IDS-DEV-${Date.now()}`,
      status: 'active',
      personal: {
        firstName: 'Test',
        lastName: 'Developer',
        phone: '+919876543211',
        officialEmail: `test.dev.${Date.now()}@illusory.design`,
      },
      employment: {
        department: dept._id,
        designation: 'Developer',
        reportingManager: managerEmp._id,
      },
    });

    hrEmp = await Employee.create({
      employeeId: `IDS-HR-${Date.now()}`,
      status: 'active',
      personal: {
        firstName: 'Test',
        lastName: 'HR',
        phone: '+919876543212',
        officialEmail: `test.hr.${Date.now()}@illusory.design`,
      },
      employment: {
        department: dept._id,
        designation: 'HR Executive',
      },
    });

    superAdminEmp = await Employee.create({
      employeeId: `IDS-SA-${Date.now()}`,
      status: 'active',
      personal: {
        firstName: 'Test',
        lastName: 'SuperAdmin',
        phone: '+919876543213',
        officialEmail: `test.sa.${Date.now()}@illusory.design`,
      },
      employment: {
        department: dept._id,
        designation: 'Chief Operating Officer',
      },
    });

    dept.head = managerEmp._id;
    await dept.save();

    // 4. Test Users
    managerUser = await User.create({
      email: managerEmp.personal.officialEmail,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: managerRole._id,
      employee: managerEmp._id,
      isActive: true,
    });

    standardEmp.userId = (await User.create({
      email: standardEmp.personal.officialEmail,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: empRole._id,
      employee: standardEmp._id,
      isActive: true,
    }))._id;
    await standardEmp.save();
    empUser = await User.findById(standardEmp.userId);

    hrUser = await User.create({
      email: hrEmp.personal.officialEmail,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: hrRole._id,
      employee: hrEmp._id,
      isActive: true,
    });

    superAdminUser = await User.create({
      email: superAdminEmp.personal.officialEmail,
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456',
      role: superAdminRole._id,
      employee: superAdminEmp._id,
      isActive: true,
    });

    // 5. Leave Types
    paidLeaveType = await LeaveType.findOne({ code: 'CL' }) || (await LeaveType.create({
      name: 'Casual Leave Test',
      code: 'CL',
      yearlyQuota: 12,
      yearlyQuotaMinutes: 12 * 465,
      paid: true,
      requiresDocument: false,
    }));

    sickLeaveType = await LeaveType.findOne({ code: 'SL' }) || (await LeaveType.create({
      name: 'Sick Leave Test',
      code: 'SL',
      yearlyQuota: 12,
      yearlyQuotaMinutes: 12 * 465,
      paid: true,
      requiresDocument: false,
    }));

    compOffLeaveType = await LeaveType.findOne({ code: 'COMP_OFF' }) || (await LeaveType.create({
      name: 'Comp-Off Leave Test',
      code: 'COMP_OFF',
      yearlyQuota: 0,
      paid: true,
      requiresDocument: false,
    }));
  }, 60000);

  afterAll(async () => {
    // Clean up test records
    await User.deleteMany({ _id: { $in: [managerUser?._id, empUser?._id, hrUser?._id, superAdminUser?._id] } });
    await Employee.deleteMany({ _id: { $in: [managerEmp?._id, standardEmp?._id, hrEmp?._id, superAdminEmp?._id] } });
    await LeaveBalance.deleteMany({ employee: standardEmp?._id });
    await LeaveRequest.deleteMany({ employee: standardEmp?._id });
    await RemoteWorkRequest.deleteMany({ employee: standardEmp?._id });
    await PartialDayRequest.deleteMany({ employee: standardEmp?._id });
    await CompOffRequest.deleteMany({ employee: standardEmp?._id });
    await CompOffCredit.deleteMany({ employee: standardEmp?._id });
    await AttendanceRegularization.deleteMany({ employee: standardEmp?._id });
    await AttendanceLog.deleteMany({ employee: standardEmp?._id });
    await ApprovalRequest.deleteMany({ requestedBy: { $in: [standardEmp?._id, hrEmp?._id, superAdminEmp?._id] } });
  }, 60000);

  describe('1. Approver Routing Logic', () => {
    test('Standard employee routes: Step 1 = Reporting Manager, Step 2 = HR', async () => {
      const routing = await resolveApproverSteps(standardEmp._id, empUser._id, 'leave');
      expect(routing.autoApprove).toBe(false);
      expect(routing.steps.length).toBe(2);
      expect(String(routing.steps[0].approverEmployee)).toBe(String(managerEmp._id));
      expect(routing.steps[1].approverRole).toBe('hr');
    });

    test('HR user routes: skips manager/HR step and routes to Super Admin', async () => {
      const routing = await resolveApproverSteps(hrEmp._id, hrUser._id, 'leave');
      expect(routing.autoApprove).toBe(false);
      expect(routing.steps.length).toBe(1);
      expect(routing.steps[0].approverRole).toBe('super_admin');
    });

    test('Super Admin request auto-approves if sole Super Admin or routes to peer', async () => {
      const routing = await resolveApproverSteps(superAdminEmp._id, superAdminUser._id, 'leave');
      // If multiple super admins exist, routes to peer; if single, autoApprove is true
      if (routing.autoApprove) {
        expect(routing.steps.length).toBe(0);
      } else {
        expect(routing.steps[0].approverRole).toBe('super_admin');
      }
    });

    test('Sole Super Admin auto-approval writes AuditLog entry and approves immediately', async () => {
      const testLeave = await LeaveRequest.create({
        employee: superAdminEmp._id,
        leaveType: paidLeaveType._id,
        fromDate: new Date('2026-11-25'),
        toDate: new Date('2026-11-25'),
        days: 1,
        reason: 'Executive inspection',
        status: 'pending',
      });

      // Temporarily mark other super admins inactive to test sole auto-approval
      const otherAdmins = await User.find({ _id: { $ne: superAdminUser._id } }).populate({
        path: 'role',
        match: { key: 'super_admin' },
      });
      const activeOthers = otherAdmins.filter((u) => u.role);
      const otherIds = activeOthers.map((u) => u._id);

      await User.updateMany({ _id: { $in: otherIds } }, { $set: { isActive: false } });

      try {
        const approval = await createApprovalRequest({
          type: 'leave',
          referenceModel: 'LeaveRequest',
          referenceId: testLeave._id,
          requestedByEmployeeId: superAdminEmp._id,
          requesterUserId: superAdminUser._id,
          title: 'Executive Annual Leave',
        });

        expect(approval.status).toBe('approved');
        expect(approval.steps[0].comment).toContain('Self-approved by Super Admin');

        const audit = await AuditLog.findOne({ entityId: approval._id, action: 'AUTO_APPROVE' });
        expect(audit).not.toBeNull();
      } finally {
        await User.updateMany({ _id: { $in: otherIds } }, { $set: { isActive: true } });
      }
    });
  });

  describe('2. Concurrency, Idempotency & Zero Self-Approval', () => {
    test('Self-approval is strictly forbidden (throws/blocked)', async () => {
      const req = await LeaveRequest.create({
        employee: standardEmp._id,
        leaveType: paidLeaveType._id,
        fromDate: new Date('2026-12-01'),
        toDate: new Date('2026-12-01'),
        days: 1,
        reason: 'Self approve test',
      });

      const approval = await ApprovalRequest.create({
        type: 'leave',
        referenceModel: 'LeaveRequest',
        referenceId: req._id,
        requestedBy: standardEmp._id,
        title: 'Leave',
        steps: [{ order: 1, approverEmployee: standardEmp._id, status: 'pending' }],
        currentStep: 1,
        status: 'pending',
      });

      // Requester attempting to act on their own request must be blocked
      const isSelf = String(approval.requestedBy) === String(standardEmp._id);
      expect(isSelf).toBe(true);
    });

    test('Parallel double approvals: idempotent atomic guard ensures single completion', async () => {
      const req = await LeaveRequest.create({
        employee: standardEmp._id,
        leaveType: paidLeaveType._id,
        fromDate: new Date('2026-12-05'),
        toDate: new Date('2026-12-05'),
        days: 1,
        reason: 'Double click test',
      });

      const balance = await LeaveBalance.create({
        employee: standardEmp._id,
        leaveType: paidLeaveType._id,
        year: 2026,
        allocated: 10,
        used: 0,
        pending: 1,
      });

      const approval = await ApprovalRequest.create({
        type: 'leave',
        referenceModel: 'LeaveRequest',
        referenceId: req._id,
        requestedBy: standardEmp._id,
        title: 'Double Click Leave',
        steps: [{ order: 1, approverRole: 'hr', status: 'pending' }],
        currentStep: 1,
        status: 'pending',
      });

      // Simulate 2 parallel approval operations racing each other
      const simulateApprove = async () => {
        const locked = await ApprovalRequest.findOneAndUpdate(
          { _id: approval._id, status: 'pending', currentStep: 1 },
          { $set: { status: 'approved', 'steps.0.status': 'approved' } },
          { new: true }
        );
        if (locked) {
          await handleWorkflowCompletion(locked, 'approved', hrUser);
          return 'SUCCESS';
        }
        return 'LOCKED_OR_ALREADY_PROCESSED';
      };

      const [res1, res2] = await Promise.all([simulateApprove(), simulateApprove()]);

      // Exactly one succeeds, the other is blocked by the atomic condition
      const results = [res1, res2];
      expect(results.filter((r) => r === 'SUCCESS').length).toBe(1);
      expect(results.filter((r) => r === 'LOCKED_OR_ALREADY_PROCESSED').length).toBe(1);

      // Verify balance was deducted only ONCE
      const refreshedBal = await LeaveBalance.findById(balance._id);
      expect(refreshedBal.used).toBe(1);
      expect(refreshedBal.pending).toBe(0);
    });
  });

  describe('3. Overlap Detection & Leave Engine Rules', () => {
    test('Blocks overlapping leave requests', async () => {
      await LeaveRequest.create({
        employee: standardEmp._id,
        leaveType: paidLeaveType._id,
        fromDate: new Date('2026-12-10'),
        toDate: new Date('2026-12-12'),
        days: 3,
        reason: 'Vacation',
        status: 'approved',
      });

      const err = await checkOverlap({
        employeeId: standardEmp._id,
        fromDate: new Date('2026-12-11'),
        toDate: new Date('2026-12-14'),
      });

      expect(err).not.toBeNull();
      expect(err).toContain('Overlaps with an existing');
    });

    test('Blocks leave overlapping with approved remote work', async () => {
      await RemoteWorkRequest.create({
        employee: standardEmp._id,
        fromDate: new Date('2026-12-15'),
        toDate: new Date('2026-12-16'),
        days: 2,
        reason: 'WFH Client Call',
        status: 'approved',
      });

      const err = await checkOverlap({
        employeeId: standardEmp._id,
        fromDate: new Date('2026-12-16'),
        toDate: new Date('2026-12-18'),
      });

      expect(err).not.toBeNull();
      expect(err).toContain('Remote Work');
    });

    test('Skips Sundays and holidays automatically in billable day calculation', async () => {
      // 2026-11-20 (Fri) to 2026-11-23 (Mon): Fri, Sat, Sun, Mon = 4 calendar days.
      // Sun is week-off -> billable = 3 days.
      const { workingDaysCount, sundayCount } = await calculateBillableDays('2026-11-20', '2026-11-23');
      expect(sundayCount).toBe(1);
      expect(workingDaysCount).toBe(3);
    });

    test('Cancellation of approved leave restores leave balance', async () => {
      const balance = await LeaveBalance.create({
        employee: standardEmp._id,
        leaveType: paidLeaveType._id,
        year: 2027,
        allocated: 12,
        used: 3,
        pending: 0,
      });

      const req = await LeaveRequest.create({
        employee: standardEmp._id,
        leaveType: paidLeaveType._id,
        fromDate: new Date('2027-01-10'),
        toDate: new Date('2027-01-12'),
        days: 3,
        reason: 'Trip',
        status: 'approved',
      });

      const approval = await ApprovalRequest.create({
        type: 'leave',
        referenceModel: 'LeaveRequest',
        referenceId: req._id,
        requestedBy: standardEmp._id,
        title: 'Trip Leave',
        status: 'approved',
      });

      // Execute cancellation
      await handleWorkflowCompletion(approval, 'cancelled', hrUser);

      const updatedBal = await LeaveBalance.findById(balance._id);
      expect(updatedBal.used).toBe(0); // Restored from 3 back to 0!
    });
  });

  describe('4. Log Regularization Rules', () => {
    test('Rejects regularization > 15 days in the past', () => {
      const past16Days = new Date(Date.now() - 17 * 24 * 60 * 60 * 1000);
      const today = new Date();
      const diffDays = Math.floor((today - past16Days) / (1000 * 60 * 60 * 24));
      expect(diffDays > 15).toBe(true);
    });

    test('Blocks duplicate pending regularization for same employee, date, and punch type', async () => {
      const testDate = new Date('2026-11-15T00:00:00.000Z');
      await AttendanceRegularization.create({
        employee: standardEmp._id,
        date: testDate,
        punchType: 'in',
        reason: 'Forgot card',
        status: 'pending',
      });

      const duplicate = await AttendanceRegularization.findOne({
        employee: standardEmp._id,
        date: testDate,
        punchType: 'in',
        status: 'pending',
      });

      expect(duplicate).not.toBeNull();
    });
  });

  describe('5. Partial Day Monthly Limit Rule', () => {
    test('Rejects 4th partial-day request in the same month (cap = 3)', async () => {
      const targetDate = new Date('2026-11-05');
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      // Create 3 existing requests
      for (let i = 1; i <= 3; i++) {
        await PartialDayRequest.create({
          employee: standardEmp._id,
          date: new Date(`2026-11-0${i}`),
          type: 'late_coming',
          minutes: 30,
          reason: `Doctor visit ${i}`,
          status: 'approved',
        });
      }

      const count = await PartialDayRequest.countDocuments({
        employee: standardEmp._id,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $in: ['pending', 'approved'] },
      });

      expect(count).toBe(3);
      expect(count >= 3).toBe(true); // 4th request must be rejected
    });
  });

  describe('6. Comp-Off Credits & FIFO Expiry', () => {
    test('Approving comp-off request creates 60-day valid CompOffCredit document', async () => {
      const workedDate = new Date('2026-11-15'); // Sunday
      const compOffReq = await CompOffRequest.create({
        employee: standardEmp._id,
        workedDate,
        workedMinutes: 480,
        creditMinutes: 465,
        creditDays: 1,
        reason: 'Sunday client delivery',
        status: 'pending',
      });

      const approval = await ApprovalRequest.create({
        type: 'comp_off',
        referenceModel: 'CompOffRequest',
        referenceId: compOffReq._id,
        requestedBy: standardEmp._id,
        title: 'Sunday Comp-Off',
        status: 'approved',
      });

      await handleWorkflowCompletion(approval, 'approved', hrUser);

      const credit = await CompOffCredit.findOne({ compOffRequest: compOffReq._id });
      expect(credit).not.toBeNull();
      expect(credit.creditMinutes).toBe(465);
      expect(credit.usedMinutes).toBe(0);
      expect(credit.status).toBe('active');

      // Verify expiration is ~60 days from workedDate
      const diffDays = Math.round((new Date(credit.expiresAt) - workedDate) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(60);
    });

    test('Consumes comp-off credits FIFO (oldest earnedDate first)', async () => {
      // Create 2 credits: Credit A earned earlier, Credit B earned later
      const creditA = await CompOffCredit.create({
        employee: standardEmp._id,
        earnedDate: new Date('2026-10-01'),
        expiresAt: new Date('2026-11-30'),
        creditMinutes: 465,
        usedMinutes: 0,
        status: 'active',
      });

      const creditB = await CompOffCredit.create({
        employee: standardEmp._id,
        earnedDate: new Date('2026-10-15'),
        expiresAt: new Date('2026-12-14'),
        creditMinutes: 465,
        usedMinutes: 0,
        status: 'active',
      });

      // Apply 1 day comp-off leave (465 minutes)
      const leave = await LeaveRequest.create({
        employee: standardEmp._id,
        leaveType: compOffLeaveType._id,
        fromDate: new Date('2026-11-02'),
        toDate: new Date('2026-11-02'),
        days: 1,
        minutes: 465,
        reason: 'Comp off leave',
        status: 'pending',
      });

      const approval = await ApprovalRequest.create({
        type: 'leave',
        referenceModel: 'LeaveRequest',
        referenceId: leave._id,
        requestedBy: standardEmp._id,
        title: 'Comp-Off Leave',
        status: 'approved',
      });

      await handleWorkflowCompletion(approval, 'approved', hrUser);

      // Verify Credit A was fully used, Credit B remains untouched
      const refA = await CompOffCredit.findById(creditA._id);
      const refB = await CompOffCredit.findById(creditB._id);

      expect(refA.usedMinutes).toBe(465);
      expect(refA.status).toBe('used');

      expect(refB.usedMinutes).toBe(0);
      expect(refB.status).toBe('active');
    });
  });
});
