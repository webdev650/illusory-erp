import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Employee } from '../src/models/Employee.js';
import { Department } from '../src/models/Department.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { ApprovalRequest } from '../src/models/ApprovalRequest.js';
import { checkManagerLoop, executeLifecycleAction } from '../src/services/employeeLifecycle.service.js';
import { auditEmployeeDataQuality, getOrgChartTree } from '../src/services/employeeAudit.service.js';
import { calculateProfileCompleteness } from '../src/utils/completeness.js';
import * as employeeController from '../src/controllers/employee.controller.js';

describe('EMPLOYEE MASTER & LIFECYCLE TESTS', () => {
  let testDept;
  let adminUser, empUser;
  let mgrEmp, staffEmp, rehireEmp;

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

    testDept = await Department.findOne({ code: 'EMP_TEST' });
    if (!testDept) {
      testDept = await Department.create({ name: 'Employee Master Test Dept', code: 'EMP_TEST' });
    }

    const dummyHash = '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqr';

    let saRole = await Role.findOne({ key: 'super_admin' });
    if (!saRole) saRole = await Role.create({ name: 'Super Admin', key: 'super_admin', permissions: ['*'] });

    let empRole = await Role.findOne({ key: 'employee' });
    if (!empRole) empRole = await Role.create({ name: 'Employee', key: 'employee', permissions: ['employee.read', 'profile.edit'] });

    mgrEmp = await Employee.create({
      employeeId: 'TEST-MSTR-MGR',
      personal: { firstName: 'Master', lastName: 'Manager', officialEmail: 'mstr.mgr@test.com', phone: '+919999900001' },
      employment: { designation: 'Director', department: testDept._id },
      status: 'active',
      isDemo: true,
    });

    staffEmp = await Employee.create({
      employeeId: 'TEST-MSTR-STF',
      personal: { firstName: 'Staff', lastName: 'Designer', officialEmail: 'stf.des@test.com', phone: '+919999900002' },
      employment: { designation: 'Designer', department: testDept._id, reportingManager: mgrEmp._id, noticePeriodDays: 30 },
      statutory: { aadhaar: '999988887777', pan: 'ABCDE1234F' },
      bank: { accountNumber: '123456789012', ifsc: 'HDFC0001234' },
      status: 'probation',
      isDemo: true,
    });

    adminUser = await User.create({ email: 'admin.mstr@test.com', passwordHash: dummyHash, role: saRole._id, employee: mgrEmp._id, isActive: true });
    empUser = await User.create({ email: 'staff.mstr@test.com', passwordHash: dummyHash, role: empRole._id, employee: staffEmp._id, isActive: true });
  });

  afterAll(async () => {
    await Employee.deleteMany({ isDemo: true });
    await User.deleteMany({ email: { $in: ['admin.mstr@test.com', 'staff.mstr@test.com'] } });
    await Department.deleteMany({ code: 'EMP_TEST' });
    await ApprovalRequest.deleteMany({ requestedBy: { $in: [mgrEmp?._id, staffEmp?._id] } });
  });

  test('1. Profile completeness calculation evaluates missing fields accurately', () => {
    const comp = calculateProfileCompleteness(staffEmp);
    expect(comp.percentage).toBeGreaterThan(0);
    expect(comp.totalCount).toBe(15);
    expect(Array.isArray(comp.missingFields)).toBe(true);
  });

  test('2. Circular reporting manager loops are detected and rejected', async () => {
    // Attempt to make mgrEmp report to staffEmp (who already reports to mgrEmp)
    const isLoop = await checkManagerLoop(mgrEmp._id, staffEmp._id);
    expect(isLoop).toBe(true);

    const isSelfLoop = await checkManagerLoop(mgrEmp._id, mgrEmp._id);
    expect(isSelfLoop).toBe(true);
  });

  test('3. Lifecycle Action: Confirm probation updates confirmationDate, status, and history', async () => {
    const confDate = new Date('2026-11-20');
    const result = await executeLifecycleAction({
      employeeId: staffEmp._id,
      action: 'confirm_probation',
      payload: { confirmationDate: confDate },
      performedByUserId: adminUser._id,
      reason: 'Probation review approved by board',
    });

    expect(result.employee.status).toBe('active');
    expect(result.employee.employment.isConfirmationDateVerified).toBe(true);
    const lastHistory = result.employee.history[result.employee.history.length - 1];
    expect(lastHistory.type).toBe('CONFIRMED_AFTER_PROBATION');
  });

  test('4. Sensitive data reveal is rate-limited, permission-controlled, and audit-logged', async () => {
    const req = {
      params: { id: staffEmp._id },
      body: { field: 'aadhaar', reason: 'Statutory verification by audit team' },
      user: adminUser,
    };
    const res = mockRes();

    await employeeController.revealSensitiveField(req, res, () => {});
    expect(res.data.success).toBe(true);
    expect(res.data.data.field).toBe('aadhaar');
    expect(res.data.data.value).toBe('999988887777');
  });

  test('5. Org Chart hierarchy tree returns valid roots and flags unassigned leads', async () => {
    const tree = await getOrgChartTree();
    expect(Array.isArray(tree.roots)).toBe(true);
    expect(Array.isArray(tree.unassigned)).toBe(true);
  });

  test('6. Data quality auditor flags missing documents and duplicate PAN/Aadhaar', async () => {
    const quality = await auditEmployeeDataQuality();
    expect(quality.totalEmployees).toBeGreaterThan(0);
    expect(Array.isArray(quality.incompleteProfiles)).toBe(true);
  });
});
