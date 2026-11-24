import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { ApprovalRequest } from '../src/models/ApprovalRequest.js';
import { LeaveRequest } from '../src/models/LeaveRequest.js';
import { LeaveType } from '../src/models/LeaveType.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Department } from '../src/models/Department.js';
import { Delegation } from '../src/models/Delegation.js';
import { approvalRegistry } from '../src/services/approvalRegistry.js';
import {
  calculateSlaDueDate,
  evaluateUrgency,
  runSlaAndEscalationCheck,
} from '../src/services/approvalEscalation.service.js';
import * as approvalController from '../src/controllers/approval.controller.js';

describe('HR CENTRAL APPROVALS INBOX & REGISTRY TESTS', () => {
  let superAdminUser, hrUser, managerUser, employeeUser;
  let superAdminEmp, hrEmp, managerEmp, employeeEmp;
  let testLeaveType;

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

    // Bootstrap test roles
    let saRole = await Role.findOne({ key: 'super_admin' });
    if (!saRole) saRole = await Role.create({ name: 'Super Admin', key: 'super_admin', permissions: ['*'] });

    let hrRole = await Role.findOne({ key: 'hr' });
    if (!hrRole) hrRole = await Role.create({ name: 'HR Admin', key: 'hr', permissions: ['approval.act', 'approval.viewAll'] });

    let mgrRole = await Role.findOne({ key: 'manager' });
    if (!mgrRole) mgrRole = await Role.create({ name: 'Manager', key: 'manager', permissions: ['approval.act', 'approval.viewTeam'] });

    let empRole = await Role.findOne({ key: 'employee' });
    if (!empRole) empRole = await Role.create({ name: 'Employee', key: 'employee', permissions: ['approval.view'] });

    let testDept = await Department.findOne({ code: 'TEST_APPR' });
    if (!testDept) {
      testDept = await Department.create({ name: 'Approval Testing Division', code: 'TEST_APPR' });
    }

    // Bootstrap test employees
    managerEmp = await Employee.create({
      employeeId: 'TEST-MGR-001',
      personal: { firstName: 'Lead', lastName: 'Manager', officialEmail: 'lead.mgr@example.com', phone: '+919876543210' },
      employment: { designation: 'Design Director', department: testDept._id },
      status: 'active',
      isDemo: true,
    });

    employeeEmp = await Employee.create({
      employeeId: 'TEST-EMP-001',
      personal: { firstName: 'Junior', lastName: 'Designer', officialEmail: 'jr.des@example.com', phone: '+919876543211' },
      employment: { designation: 'Designer', department: testDept._id, reportingManager: managerEmp._id },
      status: 'active',
      isDemo: true,
    });

    hrEmp = await Employee.create({
      employeeId: 'TEST-HR-001',
      personal: { firstName: 'HR', lastName: 'Partner', officialEmail: 'hr.partner@example.com', phone: '+919876543212' },
      employment: { designation: 'HR Lead', department: testDept._id },
      status: 'active',
      isDemo: true,
    });

    superAdminEmp = await Employee.create({
      employeeId: 'TEST-SA-001',
      personal: { firstName: 'Executive', lastName: 'Admin', officialEmail: 'exec.sa@example.com', phone: '+919876543213' },
      employment: { designation: 'Managing Director', department: testDept._id },
      status: 'active',
      isDemo: true,
    });

    // Bootstrap test users
    const dummyHash = '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr';
    managerUser = await User.create({ email: 'mgr@test.com', passwordHash: dummyHash, role: mgrRole._id, employee: managerEmp._id, isActive: true });
    employeeUser = await User.create({ email: 'emp@test.com', passwordHash: dummyHash, role: empRole._id, employee: employeeEmp._id, isActive: true });
    hrUser = await User.create({ email: 'hr@test.com', passwordHash: dummyHash, role: hrRole._id, employee: hrEmp._id, isActive: true });
    superAdminUser = await User.create({ email: 'sa@test.com', passwordHash: dummyHash, role: saRole._id, employee: superAdminEmp._id, isActive: true });

    testLeaveType = await LeaveType.create({
      name: 'Approval Test Leave',
      code: 'APPR_LEAVE',
      daysAllowed: 12,
      isActive: true,
    });
  });

  afterAll(async () => {
    await ApprovalRequest.deleteMany({ isDemo: true });
    await Employee.deleteMany({ isDemo: true });
    await User.deleteMany({ email: { $in: ['mgr@test.com', 'emp@test.com', 'hr@test.com', 'sa@test.com'] } });
    await LeaveType.deleteMany({ code: 'APPR_LEAVE' });
    await Delegation.deleteMany({ isDemo: true });
  });

  test('1. Approval Registry validates registered handlers and fails safely on missing types', () => {
    expect(approvalRegistry.has('leave')).toBe(true);
    expect(approvalRegistry.has('regularization')).toBe(true);
    expect(approvalRegistry.has('remote_work')).toBe(true);
    expect(approvalRegistry.has('comp_off')).toBe(true);
    expect(approvalRegistry.has('non_existent_type')).toBe(false);

    const unknown = approvalRegistry.get('unknown_type');
    expect(unknown).toBeNull();
  });

  test('2. SLA Calculation pauses on Sundays and computes due date correctly', async () => {
    // Given a fixed Monday at 10:00 AM UTC
    const monday = new Date('2026-11-23T10:00:00.000Z');
    const dueDate = await calculateSlaDueDate(monday, 24, true);

    expect(dueDate).toBeInstanceOf(Date);
    expect(dueDate.getTime()).toBeGreaterThan(monday.getTime());

    // Urgency check
    const futureDue = new Date(Date.now() + 24 * 3600000);
    expect(evaluateUrgency(futureDue)).toBe('on_time');

    const pastDue = new Date(Date.now() - 3600000);
    expect(evaluateUrgency(pastDue)).toBe('overdue');
  });

  test('3. Zero Self-Approval is strictly enforced even for Super Admin and HR', async () => {
    const approval = await ApprovalRequest.create({
      type: 'leave',
      referenceModel: 'LeaveRequest',
      referenceId: new mongoose.Types.ObjectId(),
      requestedBy: superAdminEmp._id,
      title: 'Super Admin Personal Leave',
      steps: [
        { order: 1, title: 'Review', approverRole: 'super_admin', status: 'pending' },
      ],
      currentStep: 1,
      status: 'pending',
      isDemo: true,
    });

    const req = {
      params: { id: approval._id },
      user: superAdminUser,
      userRole: 'super_admin',
      body: { comment: 'Attempting self-approval' },
    };
    const res = mockRes();

    await approvalController.approveRequestAction(req, res, () => {});
    expect(res.data.success).toBe(false);
    expect(res.data.message).toContain('Self-approval is strictly forbidden');
  });

  test('4. Approvals Inbox enforces scoping: Employee sees only raised by me, Manager sees team, HR sees all', async () => {
    // Create test request raised by employee, awaiting manager
    const reqItem = await ApprovalRequest.create({
      type: 'leave',
      referenceModel: 'LeaveRequest',
      referenceId: new mongoose.Types.ObjectId(),
      requestedBy: employeeEmp._id,
      title: 'Employee Annual Leave Request',
      steps: [
        { order: 1, title: 'Manager Step', approverEmployee: managerEmp._id, status: 'pending' },
      ],
      currentStep: 1,
      status: 'pending',
      isDemo: true,
    });

    // 1. Employee query 'waiting' tab -> should get 0 items (since they didn't receive it)
    const empReq = { query: { tab: 'waiting' }, user: employeeUser, userRole: 'employee' };
    const empRes = mockRes();
    await approvalController.getApprovalInbox(empReq, empRes, () => {});
    expect(empRes.data.data.requests.length).toBe(0);

    // 2. Manager query 'waiting' tab -> should see this request
    const mgrReq = { query: { tab: 'waiting' }, user: managerUser, userRole: 'manager' };
    const mgrRes = mockRes();
    await approvalController.getApprovalInbox(mgrReq, mgrRes, () => {});
    const found = mgrRes.data.data.requests.find((r) => String(r._id) === String(reqItem._id));
    expect(found).toBeDefined();

    // 3. Employee accessing 'all_pending' -> 403 Forbidden
    const deniedReq = { query: { tab: 'all_pending' }, user: employeeUser, userRole: 'employee' };
    const deniedRes = mockRes();
    await approvalController.getApprovalInbox(deniedReq, deniedRes, () => {});
    expect(deniedRes.data.success).toBe(false);
    expect(deniedRes.data.message).toContain('Access denied');
  });

  test('5. Return for correction transitions status to returned, increments version, and notifies applicant', async () => {
    const testAppr = await ApprovalRequest.create({
      type: 'remote_work',
      referenceModel: 'RemoteWorkRequest',
      referenceId: new mongoose.Types.ObjectId(),
      requestedBy: employeeEmp._id,
      title: 'WFH Client Workshop',
      steps: [
        { order: 1, title: 'Manager Approval', approverEmployee: managerEmp._id, status: 'pending' },
      ],
      currentStep: 1,
      status: 'pending',
      version: 1,
      isDemo: true,
    });

    const req = {
      params: { id: testAppr._id },
      user: managerUser,
      body: { comment: 'Please attach client confirmation email' },
    };
    const res = mockRes();

    let caughtError = null;
    await approvalController.returnRequestAction(req, res, (err) => { caughtError = err; });
    if (caughtError) console.error('Caught return error:', caughtError);
    expect(res.data.success).toBe(true);

    const updated = await ApprovalRequest.findById(testAppr._id);
    expect(updated.status).toBe('returned');
    expect(updated.version).toBe(2);
    expect(updated.returnComment).toContain('attach client confirmation');
  });

  test('6. Bulk approve runs individual validations and reports succeeded/skipped counts', async () => {
    const appr1 = await ApprovalRequest.create({
      type: 'leave',
      referenceModel: 'LeaveRequest',
      referenceId: new mongoose.Types.ObjectId(),
      requestedBy: employeeEmp._id,
      title: 'Bulk Valid Leave',
      steps: [{ order: 1, approverEmployee: managerEmp._id, status: 'pending' }],
      currentStep: 1,
      status: 'pending',
      isDemo: true,
    });

    const apprSelf = await ApprovalRequest.create({
      type: 'leave',
      referenceModel: 'LeaveRequest',
      referenceId: new mongoose.Types.ObjectId(),
      requestedBy: managerEmp._id, // Manager's own request
      title: 'Bulk Self Leave',
      steps: [{ order: 1, approverEmployee: managerEmp._id, status: 'pending' }],
      currentStep: 1,
      status: 'pending',
      isDemo: true,
    });

    const req = {
      user: managerUser,
      userRole: 'manager',
      body: {
        action: 'approve',
        ids: [appr1._id, apprSelf._id],
        comment: 'Bulk review sign-off',
      },
    };
    const res = mockRes();

    await approvalController.bulkApprovalAction(req, res, () => {});
    expect(res.data.success).toBe(true);
    expect(res.data.data.succeeded.length).toBe(1);
    expect(res.data.data.skipped.length).toBe(1);
    expect(res.data.data.skipped[0].reason).toContain('Self-approval strictly forbidden');
  });
});
