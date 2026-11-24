import 'dotenv/config';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import { LetterTemplate } from '../src/models/LetterTemplate.js';
import { LetterCounter } from '../src/models/LetterCounter.js';
import { IssuedLetter } from '../src/models/IssuedLetter.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Department } from '../src/models/Department.js';
import { ApprovalRequest } from '../src/models/ApprovalRequest.js';
import {
  validateTemplateVariables,
  sanitizeTemplateHtml,
  renderTemplateBody,
  generateDocumentHash,
} from '../src/services/letterTemplate.service.js';
import { getNextLetterRefNo, seedStarterTemplatesIfEmpty } from '../src/services/letterIssuance.service.js';
import { generateLetterPdfBuffer } from '../src/services/letterPdf.service.js';
import { approvalRegistry } from '../src/services/approvalRegistry.js';
import * as letterController from '../src/controllers/letter.controller.js';

describe('LETTERS & DOCUMENTS MODULE TEST SUITE', () => {
  let superAdminUser, hrUser, employeeUser;
  let testDept, testEmployee, approvalTemplate;

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

    // Roles
    let saRole = await Role.findOne({ key: 'super_admin' });
    if (!saRole) saRole = await Role.create({ name: 'Super Admin', key: 'super_admin', permissions: ['*'] });

    let hrRole = await Role.findOne({ key: 'hr' });
    if (!hrRole) hrRole = await Role.create({ name: 'HR Admin', key: 'hr', permissions: ['letter.view', 'letter.generate', 'letter.revoke', 'letter.template.manage', 'letter.template.review', 'document.manage'] });

    let empRole = await Role.findOne({ key: 'employee' });
    if (!empRole) empRole = await Role.create({ name: 'Employee', key: 'employee', permissions: ['letter.view', 'letter.request'] });

    testDept = await Department.findOne({ code: 'DESIGN' });
    if (!testDept) {
      testDept = await Department.create({ name: 'Design Studio', code: 'DESIGN' });
    }

    // Clean up test employee if exists
    await Employee.deleteOne({ employeeId: 'IDS-TEST-LET-01' });
    testEmployee = await Employee.create({
      employeeId: 'IDS-TEST-LET-01',
      personal: {
        firstName: 'Ananya',
        lastName: 'Rath',
        email: 'ananya.personal@example.com',
        officialEmail: 'ananya.test@illusorydesignstudios.com',
        phone: '9876543299',
        gender: 'Female',
        currentAddress: {
          addressLine1: 'Plot 42, Infocity',
          city: 'Bhubaneswar',
          state: 'Odisha',
          pinCode: '751024',
        },
      },
      employment: {
        department: testDept._id,
        designation: 'Senior Visual Designer',
        employmentType: 'full_time',
        status: 'probation',
        joiningDate: new Date('2026-02-01'),
      },
    });

    superAdminUser = {
      _id: new mongoose.Types.ObjectId(),
      role: { key: 'super_admin' },
      employee: testEmployee,
    };

    hrUser = {
      _id: new mongoose.Types.ObjectId(),
      role: { key: 'hr' },
      employee: testEmployee,
    };

    employeeUser = {
      _id: new mongoose.Types.ObjectId(),
      role: { key: 'employee' },
      employee: testEmployee,
    };
  });

  afterAll(async () => {
    // Cleanup generated test data
    await Employee.deleteOne({ employeeId: 'IDS-TEST-LET-01' });
    await IssuedLetter.deleteMany({ 'candidate.name': 'Test Candidate' });
    await IssuedLetter.deleteMany({ employee: testEmployee?._id });
    await LetterTemplate.deleteMany({ code: /^TEST_/ });
  });

  describe('1. Template Variable Whitelist & Security Validation', () => {
    test('Should accept valid whitelisted template variables', () => {
      const validBody = '<p>Dear {{employee.fullName}}, welcome to {{company.name}} as {{employee.designation}}!</p>';
      const result = validateTemplateVariables(validBody);
      expect(result.isValid).toBe(true);
      expect(result.unknownVariables).toHaveLength(0);
    });

    test('Should reject unwhitelisted or potentially malicious template variables', () => {
      const maliciousBody = '<p>Hello {{malicious.payload}}, token is {{process.env.SECRET}}</p>';
      const result = validateTemplateVariables(maliciousBody);
      expect(result.isValid).toBe(false);
      expect(result.unknownVariables).toContain('malicious.payload');
      expect(result.unknownVariables).toContain('process.env.SECRET');
    });

    test('Should sanitize dangerous script and iframe tags from template body', () => {
      const rawHtml = '<p>Normal text <script>alert("xss")</script><iframe src="evil.com"></iframe></p>';
      const sanitized = sanitizeTemplateHtml(rawHtml);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).toContain('<p>Normal text </p>');
    });

    test('Should render template with resolved employee and company values', () => {
      const body = '<p>Dear {{employee.fullName}}, joining on {{employee.joiningDate}} at {{company.name}}.</p>';
      const rendered = renderTemplateBody(body, {
        employee: {
          fullName: 'Ananya Rath',
          joiningDate: '01/02/2026',
        },
        company: {
          name: 'Illusory Design Studios Pvt. Ltd.',
        },
      });

      expect(rendered).toContain('Ananya Rath');
      expect(rendered).toContain('01/02/2026');
      expect(rendered).toContain('Illusory Design Studios Pvt. Ltd.');
    });

    test('Should generate deterministic SHA-256 hash for document content', () => {
      const content = '<p>Formal Relieving Letter for Ananya Rath</p>';
      const hash1 = generateDocumentHash(content);
      const hash2 = generateDocumentHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe('2. Atomic Sequential Reference Numbering', () => {
    test('Should generate sequential reference numbers with format IDS/HR/<CAT>/<YY>/<0001>', async () => {
      const year = 2026;
      const ref1 = await getNextLetterRefNo('offer', year);
      const ref2 = await getNextLetterRefNo('offer', year);

      expect(ref1).toMatch(/^IDS\/HR\/OFFER\/26\/\d{4}$/);
      expect(ref2).toMatch(/^IDS\/HR\/OFFER\/26\/\d{4}$/);

      const seq1 = parseInt(ref1.split('/').pop(), 10);
      const seq2 = parseInt(ref2.split('/').pop(), 10);
      expect(seq2).toBe(seq1 + 1);
    });

    test('Concurrent requests generate gapless non-colliding reference numbers', async () => {
      const results = await Promise.all([
        getNextLetterRefNo('appointment', 2026),
        getNextLetterRefNo('appointment', 2026),
        getNextLetterRefNo('appointment', 2026),
      ]);

      const seqs = results.map((r) => parseInt(r.split('/').pop(), 10)).sort((a, b) => a - b);
      expect(new Set(seqs).size).toBe(3);
      expect(seqs[1]).toBe(seqs[0] + 1);
      expect(seqs[2]).toBe(seqs[1] + 1);
    });
  });

  describe('3. Starter Templates & Unreviewed Sample Safeguard', () => {
    test('Should seed starter templates with isSample=true and isReviewed=false', async () => {
      await seedStarterTemplatesIfEmpty();
      const templates = await LetterTemplate.find({ isSample: true });
      expect(templates.length).toBeGreaterThanOrEqual(8);
      const unreviewed = templates.filter((t) => !t.isReviewed);
      expect(unreviewed.length).toBeGreaterThan(0);
    });

    test('Non-super-admin is blocked from generating letters using unreviewed sample templates', async () => {
      const sampleTpl = await LetterTemplate.findOne({ isSample: true, isReviewed: false });
      expect(sampleTpl).toBeTruthy();

      const req = {
        user: hrUser,
        userRole: 'hr',
        body: {
          templateId: sampleTpl._id,
          employeeId: testEmployee._id,
          action: 'issue',
        },
      };
      const res = mockRes();

      await letterController.generateLetter(req, res, (err) => {
        throw err;
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.data.message).toContain('SAMPLE');
    });

    test('Super Admin or HR can review sample template and unlock official issuance', async () => {
      const sampleTpl = await LetterTemplate.findOne({ isSample: true, isReviewed: false });
      const req = {
        user: hrUser,
        params: { id: sampleTpl._id },
      };
      const res = mockRes();

      await letterController.reviewTemplate(req, res, (err) => {
        throw err;
      });

      expect(res.data.success).toBe(true);
      expect(res.data.data.isReviewed).toBe(true);

      const refreshed = await LetterTemplate.findById(sampleTpl._id);
      expect(refreshed.isReviewed).toBe(true);
    });
  });

  describe('4. Letter Generation & Approval Workflow', () => {
    beforeAll(async () => {
      approvalTemplate = await LetterTemplate.create({
        name: 'Promotion Letter with Hike',
        code: 'TEST_PROMOTION_APP',
        category: 'promotion',
        body: '<p>Congratulations {{employee.fullName}}, you are promoted to {{custom.newRole}}!</p>',
        requiresApproval: true,
        isReviewed: true,
        isSample: false,
        status: 'active',
        signatory: {
          name: 'Aparna Tripathy',
          designation: 'Managing Director',
        },
      });
    });

    test('Generating letter from approval-requiring template sets status to pending_approval and creates ApprovalRequest', async () => {
      const req = {
        user: hrUser,
        userRole: 'hr',
        body: {
          templateId: approvalTemplate._id,
          employeeId: testEmployee._id,
          extraFields: { newRole: 'Lead Product Designer' },
          action: 'submit',
        },
      };
      const res = mockRes();

      await letterController.generateLetter(req, res, (err) => {
        throw err;
      });

      expect(res.status).toHaveBeenCalledWith(201);
      const letter = res.data.data;
      expect(letter.status).toBe('pending_approval');
      expect(letter.approvalRequest).toBeDefined();

      const appr = await ApprovalRequest.findById(letter.approvalRequest);
      expect(appr).toBeTruthy();
      expect(appr.type).toBe('letter');
      expect(appr.status).toBe('pending');
    });

    test('Approval registry callback onApproved transitions letter to issued and stamps digital issue details', async () => {
      const letter = await IssuedLetter.findOne({ template: approvalTemplate._id });
      expect(letter).toBeTruthy();

      const appr = await ApprovalRequest.findById(letter.approvalRequest);

      // Execute registry onApproved handler
      const letterHandler = approvalRegistry.get('letter');
      expect(letterHandler).toBeDefined();

      const updated = await letterHandler.onApproved(appr, hrUser);
      expect(updated.status).toBe('issued');
      expect(updated.issuedAt).toBeDefined();
      expect(updated.issuedBy).toEqual(hrUser._id);
    });
  });

  describe('5. PDF Generation & QR Verification', () => {
    test('generateLetterPdfBuffer renders clean A4 PDF buffer with header, body and QR block', async () => {
      const pdfBuffer = await generateLetterPdfBuffer({
        title: 'CONFIRMATION OF EMPLOYMENT',
        refNo: 'IDS/HR/CONF/26/0001',
        date: new Date(),
        renderedBody: '<p>This is to confirm that Ananya Rath is a confirmed employee of Illusory Design Studios.</p>',
        signatory: {
          name: 'Aparna Tripathy',
          designation: 'Managing Director',
        },
        verificationUrl: 'https://erp.illusorydesignstudios.com/verify/test-token-12345',
        isSample: false,
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // Valid PDF buffer starts with %PDF
      expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
    });
  });

  describe('6. Public Verification & Revocation', () => {
    let testIssuedLetter;

    beforeAll(async () => {
      const refNo = await getNextLetterRefNo('noc', 2026);
      testIssuedLetter = await IssuedLetter.create({
        template: approvalTemplate._id,
        refNo,
        title: 'No Objection Certificate (NOC)',
        category: 'noc',
        employee: testEmployee._id,
        renderedBody: '<p>NOC issued to Ananya Rath.</p>',
        status: 'issued',
        documentHash: generateDocumentHash('<p>NOC issued to Ananya Rath.</p>'),
        verificationToken: 'noc-verify-tok-789',
        issuedAt: new Date(),
        issuedBy: hrUser._id,
      });
    });

    test('Public endpoint /verify/:token returns valid verification details without authentication', async () => {
      const req = {
        params: { token: 'noc-verify-tok-789' },
      };
      const res = mockRes();

      await letterController.verifyPublicLetter(req, res, (err) => {
        throw err;
      });

      expect(res.data.success).toBe(true);
      expect(res.data.data.isValid).toBe(true);
      expect(res.data.data.status).toBe('issued');
      expect(res.data.data.refNo).toBe(testIssuedLetter.refNo);
      expect(res.data.data.issuedTo).toContain('Ananya Rath');
    });

    test('Revoking issued letter requires a reason and updates status to revoked', async () => {
      const req = {
        user: hrUser,
        userRole: 'hr',
        params: { id: testIssuedLetter._id },
        body: { reason: 'Superseded by updated official document with revised tenure' },
      };
      const res = mockRes();

      await letterController.revokeLetter(req, res, (err) => {
        throw err;
      });

      expect(res.data.success).toBe(true);
      expect(res.data.data.status).toBe('revoked');
      expect(res.data.data.revocationReason).toBe('Superseded by updated official document with revised tenure');
    });

    test('Public verification reflects revoked status and displays revocation justification', async () => {
      const req = {
        params: { token: 'noc-verify-tok-789' },
      };
      const res = mockRes();

      await letterController.verifyPublicLetter(req, res, (err) => {
        throw err;
      });

      expect(res.data.success).toBe(true);
      expect(res.data.data.isValid).toBe(false);
      expect(res.data.data.status).toBe('revoked');
      expect(res.data.data.revocationReason).toBe('Superseded by updated official document with revised tenure');
    });

    test('Public verification with invalid token returns 404', async () => {
      const req = {
        params: { token: 'non-existent-token-xyz' },
      };
      const res = mockRes();

      await letterController.verifyPublicLetter(req, res, (err) => {
        throw err;
      });

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.data.message).toContain('Invalid or unrecognized');
    });
  });
});
