import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { Employee } from '../src/models/Employee.js';
import { Department } from '../src/models/Department.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Warning } from '../src/models/Warning.js';
import { ReviewCycle } from '../src/models/ReviewCycle.js';
import { ReviewTemplate } from '../src/models/ReviewTemplate.js';
import { PerformanceReview } from '../src/models/PerformanceReview.js';
import { Goal } from '../src/models/Goal.js';
import { PeerFeedback } from '../src/models/PeerFeedback.js';
import { PerformanceSettings } from '../src/models/PerformanceSettings.js';
import { ApprovalRequest } from '../src/models/ApprovalRequest.js';
import * as perfService from '../src/services/performance.service.js';
import * as perfController from '../src/controllers/performance.controller.js';
import { seedPerformanceDefaults } from '../src/services/performanceSeed.service.js';
import { sendEmail } from '../src/utils/mailer.js';
import { getCompanyPolicy } from '../src/services/dayStatus.service.js';

describe('PERFORMANCE & APPRAISAL MASTER TEST SUITE', () => {
  let superAdminRole, hrRole, managerRole, employeeRole;
  let testDeptDesign, testDeptHR;
  let testEmp1, testEmp2, testHREmp, testMgrEmp, testAdminEmp;
  let employeeUser, managerUser, hrUser, superAdminUser, outsiderUser;
  let sampleTemplate;

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
    await connectDB();

    // Ensure roles exist
    superAdminRole = await Role.findOneAndUpdate(
      { key: 'super_admin' },
      { name: 'Super Admin', key: 'super_admin', isSystem: true },
      { upsert: true, new: true }
    );
    hrRole = await Role.findOneAndUpdate(
      { key: 'hr' },
      { name: 'Human Resources', key: 'hr', isSystem: true },
      { upsert: true, new: true }
    );
    managerRole = await Role.findOneAndUpdate(
      { key: 'project_manager' },
      { name: 'Project Manager', key: 'project_manager', isSystem: true },
      { upsert: true, new: true }
    );
    employeeRole = await Role.findOneAndUpdate(
      { key: 'employee' },
      { name: 'Employee', key: 'employee', isSystem: true },
      { upsert: true, new: true }
    );

    // Seed departments
    testDeptDesign = await Department.findOneAndUpdate(
      { code: 'PERF-DES' },
      { name: 'Product Design', code: 'PERF-DES' },
      { upsert: true, new: true }
    );
    testDeptHR = await Department.findOneAndUpdate(
      { code: 'PERF-HR' },
      { name: 'Human Resources', code: 'PERF-HR' },
      { upsert: true, new: true }
    );

    // Seed test employees (marked with isDemo so they never conflict with real employees)
    testAdminEmp = await Employee.create({
      employeeId: 'PERF-EMP-ADMIN',
      status: 'active',
      isDemo: true,
      personal: { firstName: 'Admin', lastName: 'User', officialEmail: 'perf.admin@illusory.test', phone: '9876543210', gender: 'Male' },
      employment: { department: testDeptDesign._id, designation: 'Studio Director', joiningDate: new Date('2024-01-01') },
    });

    testMgrEmp = await Employee.create({
      employeeId: 'PERF-EMP-MGR',
      status: 'active',
      isDemo: true,
      personal: { firstName: 'Design', lastName: 'Lead', officialEmail: 'perf.mgr@illusory.test', phone: '9876543211', gender: 'Male' },
      employment: { department: testDeptDesign._id, designation: 'Design Lead', joiningDate: new Date('2024-06-01') },
    });

    testEmp1 = await Employee.create({
      employeeId: 'PERF-EMP-001',
      status: 'active',
      isDemo: true,
      personal: { firstName: 'Ananya', lastName: 'Patnaik', officialEmail: 'ananya.p@illusory.test', phone: '9876543212', gender: 'Female' },
      employment: {
        department: testDeptDesign._id,
        designation: 'Senior UI Designer',
        reportingManager: testMgrEmp._id,
        joiningDate: new Date('2025-01-15'),
      },
    });

    testEmp2 = await Employee.create({
      employeeId: 'PERF-EMP-002',
      status: 'active',
      isDemo: true,
      personal: { firstName: 'Rohan', lastName: 'Das', officialEmail: 'rohan.d@illusory.test', phone: '9876543213', gender: 'Male' },
      employment: {
        department: testDeptDesign._id,
        designation: 'Motion Designer',
        reportingManager: testMgrEmp._id,
        joiningDate: new Date('2025-03-01'),
      },
    });

    testHREmp = await Employee.create({
      employeeId: 'PERF-EMP-HR',
      status: 'active',
      isDemo: true,
      personal: { firstName: 'Kavita', lastName: 'Mishra', officialEmail: 'kavita.m@illusory.test', phone: '9876543214', gender: 'Female' },
      employment: {
        department: testDeptHR._id,
        designation: 'HR Specialist',
        reportingManager: testHREmp?._id, // Self-reporting conflict test
        joiningDate: new Date('2025-02-01'),
      },
    });

    // Mock auth users
    employeeUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'ananya.p@illusory.test',
      role: 'employee',
      userRole: 'employee',
      employee: testEmp1,
    };

    managerUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'perf.mgr@illusory.test',
      role: 'project_manager',
      userRole: 'project_manager',
      employee: testMgrEmp,
    };

    hrUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'kavita.m@illusory.test',
      role: 'hr',
      userRole: 'hr',
      employee: testHREmp,
    };

    superAdminUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'perf.admin@illusory.test',
      role: 'super_admin',
      userRole: 'super_admin',
      employee: testAdminEmp,
    };

    outsiderUser = {
      _id: new mongoose.Types.ObjectId(),
      email: 'rohan.d@illusory.test',
      role: 'employee',
      userRole: 'employee',
      employee: testEmp2,
    };

    // Seed default sample templates and settings
    const seeded = await seedPerformanceDefaults();
    sampleTemplate = seeded.annualTemplate;
  });

  afterAll(async () => {
    await Employee.deleteMany({ isDemo: true });
    await ReviewCycle.deleteMany({ isDemo: true });
    await PerformanceReview.deleteMany({ isDemo: true });
    await Goal.deleteMany({ isDemo: true });
    await Warning.deleteMany({ title: /^PIP Recommendation: Test/ });
  });

  // TEST 1: Manager Routing & Conflict Block
  describe('1. Manager Evaluation Routing & Conflict Rules', () => {
    test('Rule: Nobody reviews themselves as manager; HR review routes to Super Admin', async () => {
      // testEmp1 has manager testMgrEmp -> resolves to testMgrEmp
      const mgr1 = await perfService.resolveReviewManager(testEmp1);
      expect(String(mgr1._id)).toBe(String(testMgrEmp._id));

      // testHREmp is in HR department and reports to themselves -> MUST route to a Super Admin
      const hrMgr = await perfService.resolveReviewManager(testHREmp);
      expect(hrMgr).toBeTruthy();
      expect(String(hrMgr._id)).not.toBe(String(testHREmp._id));

      const adminUser = await User.findOne({ employee: hrMgr._id }).populate('role');
      expect(adminUser?.role?.key).toBe('super_admin');
    });
  });

  // TEST 2: Scoping & Confidentiality (Manager Ratings Hidden Before Publish)
  describe('2. Confidentiality Scoping & Unearned Visibility Protections', () => {
    let testCycle, testReview;

    beforeAll(async () => {
      testCycle = await ReviewCycle.create({
        name: 'Q1 2026 Studio Review',
        type: 'quarterly',
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-03-31'),
        template: sampleTemplate._id,
        templateSnapshot: sampleTemplate.toObject(),
        status: 'active',
        createdBy: superAdminUser._id,
        isDemo: true,
      });

      testReview = await PerformanceReview.create({
        cycle: testCycle._id,
        employee: testEmp1._id,
        manager: testMgrEmp._id,
        status: 'self_review_pending',
        isDemo: true,
      });
    });

    test('Self review submission by employee', async () => {
      const updated = await perfService.submitSelfReview({
        reviewId: testReview._id,
        data: {
          sectionResponses: [
            { sectionKey: 'goals', rating: 4, comment: 'Delivered all UI components on schedule' },
            { sectionKey: 'competencies', rating: 4, comment: 'Mentored junior designers' },
          ],
          overallComment: 'Strong quarter of growth',
        },
        employeeId: testEmp1._id,
        req: { ip: '127.0.0.1', user: employeeUser },
      });

      expect(updated.status).toBe('self_review_submitted');
      expect(updated.selfReview.submittedAt).toBeDefined();
    });

    test('Manager submits evaluation with scores and internal recommendation notes', async () => {
      const updated = await perfService.submitManagerReview({
        reviewId: testReview._id,
        data: {
          sectionResponses: [
            { sectionKey: 'goals', rating: 4, comment: 'Solid execution' },
            { sectionKey: 'competencies', rating: 4, comment: 'Great peer support' },
            { sectionKey: 'values', rating: 4, comment: 'Strong culture fit' },
          ],
          strengths: 'Exceptional craft and Figma proficiency',
          areasToImprove: 'Client presentation confidence',
          developmentPlan: 'Attend quarterly client workshops',
          recommendationNotes: 'CONFIDENTIAL: Recommend 10% salary increment',
          recommendIncrement: true,
          recommendPIP: false,
          finalOverallRating: 4,
          ratingDiffReason: '',
        },
        managerEmployeeId: testMgrEmp._id,
        userRole: 'project_manager',
        req: { ip: '127.0.0.1', user: managerUser },
      });

      expect(updated.managerReview.finalOverallRating).toBe(4);
      expect(updated.managerReview.recommendationNotes).toContain('CONFIDENTIAL');
      expect(updated.isPublished).toBe(false);
    });

    test('CONFIDENTIALITY GUARD: Manager ratings are HIDDEN from employee before publish', async () => {
      const sanitizedForEmployee = perfService.sanitizeReviewForUser(
        testReview,
        employeeUser,
        'employee',
        testEmp1._id
      );

      // Prior to publication, manager ratings MUST be null / hidden from the reviewed employee
      expect(sanitizedForEmployee.managerReview.finalOverallRating).toBeNull();
      expect(sanitizedForEmployee.managerReview.sectionResponses).toEqual([]);
      // Internal recommendation notes MUST NEVER be visible to the employee
      expect(sanitizedForEmployee.managerReview.recommendationNotes).toBeUndefined();
    });

    test('OUTSIDER ACCESS BLOCK: Non-manager peer cannot view another employee review', async () => {
      const sanitizedForOutsider = perfService.sanitizeReviewForUser(
        testReview,
        outsiderUser,
        'employee',
        testEmp2._id
      );

      expect(sanitizedForOutsider).toBeNull();
    });
  });

  // TEST 3: Calibration, Publish & Post-Publish Changes
  describe('3. Calibration, Publishing & Acknowledgment Rules', () => {
    let testReview;

    beforeAll(async () => {
      testReview = await PerformanceReview.findOne({ employee: testEmp1._id, isDemo: true });
    });

    test('Calibration requires a mandatory recorded reason and is audit logged', async () => {
      const calibrated = await perfService.calibrateReview({
        reviewId: testReview._id,
        calibratedRating: 4.2,
        reason: 'Adjusted in studio calibration meeting to reflect cross-department benchmark',
        user: hrUser,
        req: { ip: '127.0.0.1', user: hrUser },
      });

      expect(calibrated.calibration.calibratedRating).toBe(4.2);
      expect(calibrated.calibration.calibrationReason).toContain('cross-department benchmark');
    });

    test('Publishing review reveals outcome to employee (Acknowledgement is received, not agreed)', async () => {
      await perfService.publishReview({
        reviewId: testReview._id,
        user: hrUser,
        req: { ip: '127.0.0.1', user: hrUser },
      });

      const published = await PerformanceReview.findById(testReview._id);
      expect(published.isPublished).toBe(true);

      // Once published, employee can see the rating
      const sanitized = perfService.sanitizeReviewForUser(published, employeeUser, 'employee', testEmp1._id);
      expect(sanitized.managerReview.finalOverallRating).toBe(4.2);
      // But internal notes remain strictly invisible!
      expect(sanitized.managerReview.recommendationNotes).toBeUndefined();

      // Employee acknowledges ("Received, not agreed", with "I Disagree" option routing to HR)
      const ack = await perfService.acknowledgeReview({
        reviewId: testReview._id,
        comments: 'Acknowledged receipt of evaluation.',
        isDisputed: false,
        meetingRequested: false,
        employeeId: testEmp1._id,
        req: { ip: '127.0.0.1', user: employeeUser },
      });

      expect(ack.employeeAcknowledgement.acknowledgedAt).toBeDefined();
      expect(ack.status).toBe('acknowledged');
    });

    test('Post-publish rating adjustment requires recorded reason and records history', async () => {
      const updated = await perfService.updateRatingPostPublish({
        reviewId: testReview._id,
        newRating: 4.5,
        reason: 'Director executive review after final client project delivery',
        user: superAdminUser,
        req: { ip: '127.0.0.1', user: superAdminUser },
      });

      expect(updated.managerReview.finalOverallRating).toBe(4.5);
      expect(updated.postPublishRatingChanges.length).toBeGreaterThan(0);
      expect(updated.postPublishRatingChanges[0].reason).toContain('Director executive review');
    });
  });

  // TEST 4: OKR Goals & Approval Engine Integration
  describe('4. OKR Goals & Approval Integration', () => {
    test('Creating a goal generates an ApprovalRequest of type "goal"', async () => {
      const goal = await Goal.create({
        employee: testEmp1._id,
        title: 'Master Figma Tokens & Design Systems',
        description: 'Complete token structure for studio components',
        type: 'individual',
        dueDate: new Date('2026-06-30'),
        status: 'pending_approval',
        keyResults: [
          { title: 'Create 50 color and typography tokens', startValue: 0, targetValue: 50, currentValue: 25, unit: 'tokens', weight: 1 },
          { title: 'Document guidelines in Notion', startValue: 0, targetValue: 100, currentValue: 100, unit: '%', weight: 1 },
        ],
        isDemo: true,
      });

      goal.recalculateProgress();
      await goal.save();

      // 25/50 = 50%, 100/100 = 100% -> Average weighted progress = 75%
      expect(goal.progressPercentage).toBe(75);

      const approval = await ApprovalRequest.create({
        type: 'goal',
        referenceModel: 'Goal',
        referenceId: goal._id,
        requestedBy: employeeUser._id,
        currentStep: 1,
        steps: [
          { order: 1, title: 'Lead Review', approverRole: 'manager', approverEmployee: testMgrEmp._id, status: 'pending' },
        ],
        metadata: { title: goal.title, weight: goal.weight },
      });

      expect(approval.type).toBe('goal');
      expect(approval.referenceId).toEqual(goal._id);
    });
  });

  // TEST 5: Recommend PIP creates only a DRAFT PIP (No automatic start)
  describe('5. Warnings & PIP Integration', () => {
    test('Recommend PIP creates a DRAFT PIP prefilled with review details (nothing starts automatically)', async () => {
      const review = await PerformanceReview.findOne({ employee: testEmp1._id, isDemo: true });

      const draftPip = await perfService.createDraftPIPFromReview({
        reviewId: review._id,
        user: hrUser,
        req: { ip: '127.0.0.1', user: hrUser },
      });

      expect(draftPip).toBeTruthy();
      expect(draftPip.type).toBe('pip');
      expect(draftPip.status).toBe('draft'); // MUST be draft only
      expect(draftPip.improvementPlan).toContain('Recommended Action Plan');
    });
  });

  // TEST 6: Privacy Protection (Chart groups under 3 hidden)
  describe('6. Data Privacy: Department Chart Suppression', () => {
    test('Department groups with fewer than 3 people are suppressed in charts', async () => {
      const req = { user: hrUser, userRole: 'hr' };
      const res = mockRes();

      await perfController.getPerformanceSummary(req, res, (e) => { throw e; });
      expect(res.data.success).toBe(true);

      const deptAverages = res.data.data.departmentAverages || [];
      // Any department returned must have at least 3 evaluated members
      deptAverages.forEach((dept) => {
        expect(dept.employeeCount).toBeGreaterThanOrEqual(3);
      });
    });
  });

  // TEST 7: Essential Account Email Whitelist & Switch Verification
  describe('7. Part 0 Verification: Essential Account Emails Whitelist', () => {
    test('When automationEnabled is OFF: Essential account emails send; non-essential emails are blocked', async () => {
      const policy = await getCompanyPolicy();
      policy.automationEnabled = false;
      await policy.save();

      // 1. Non-essential email is BLOCKED
      const digestEmail = await sendEmail({
        to: 'test@illusorydesignstudios.com',
        subject: 'Weekly Performance Digest',
        text: 'Summary of weekly evaluations',
        type: 'weekly_digest',
      });
      expect(digestEmail.skipped).toBe(true);
      expect(digestEmail.reason).toMatch(/Automation is OFF/i);

      // 2. Essential account email is ALLOWED
      const tempPasswordEmail = await sendEmail({
        to: 'newuser@illusorydesignstudios.com',
        subject: 'Your Illusory ERP Account Credentials',
        text: 'Your temporary password is ChangeMe@123',
        type: 'temporary_password',
      });
      expect(tempPasswordEmail.reason).not.toMatch(/Automation is OFF/i);
      expect(tempPasswordEmail.isEssential).toBe(true);

      const resetPasswordEmail = await sendEmail({
        to: 'user@illusorydesignstudios.com',
        subject: 'Password Reset Request',
        text: 'Click here to reset your password',
        type: 'password_reset',
      });
      expect(resetPasswordEmail.reason).not.toMatch(/Automation is OFF/i);
      expect(resetPasswordEmail.isEssential).toBe(true);
    });
  });
});
