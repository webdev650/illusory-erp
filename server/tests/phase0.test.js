import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import { getNextSequence, peekSequence } from '../src/services/counter.service.js';
import Counter from '../src/models/Counter.js';
import { encrypt, decrypt, mask } from '../src/utils/crypto.js';
import { renderTemplate, renderNamedTemplate } from '../src/services/template.service.js';
import { exportToExcel, exportToCsv } from '../src/services/export.service.js';
import { generateLetterPdf, generateInvoicePdf, generatePayslipPdf } from '../src/services/pdf.service.js';
import { getPagination, buildPaginationResult } from '../src/utils/pagination.js';
import { sanitizeData } from '../src/middleware/mongoSanitize.js';
import { sendEmail } from '../src/services/email.service.js';

describe('PHASE 0: FOUNDATION HARDENING & CORE SERVICES', () => {
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (mongoose.connection.readyState === 0 && mongoUri) {
      await mongoose.connect(mongoUri);
    }
  });

  afterAll(async () => {
    // Clean up test counters
    await Counter.deleteMany({ _id: { $regex: /^test_/ } });
  });

  describe('1. Health, Readiness & Core API Infrastructure', () => {
    it('GET / should return company API info and docs link', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.documentation).toBe('/api/docs');
      expect(res.body.requestId).toBeDefined();
    });

    it('GET /api/v1/health should return 200 with uptime and status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('healthy');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('GET /api/v1/ready should return 200 and confirm DB connection', async () => {
      const res = await request(app).get('/api/v1/ready');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database).toBe('connected');
    });

    it('GET /api/docs/ should return Swagger UI HTML', async () => {
      const res = await request(app).get('/api/docs/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger-ui');
    });

    it('GET /api/docs.json should return OpenAPI specification', async () => {
      const res = await request(app).get('/api/docs.json');
      expect(res.status).toBe(200);
      expect(res.body.openapi).toBe('3.0.3');
      expect(res.body.info.title).toContain('Illusory ERP');
    });

    it('Unknown route should return standard 404 shape with requestId', async () => {
      const res = await request(app).get('/api/v1/non-existent-route-xyz');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.requestId).toBeDefined();
    });
  });

  describe('2. Security Middleware & Sanitization', () => {
    it('should assign a unique X-Request-Id header to responses', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id'].length).toBeGreaterThan(10);
    });

    it('should strip prohibited MongoDB operators ($ and .) from payloads', () => {
      const maliciousPayload = {
        username: 'admin',
        $where: 'sleep(1000)',
        nested: {
          $gt: '',
          'user.admin': true,
        },
      };

      sanitizeData(maliciousPayload);

      expect(maliciousPayload.$where).toBeUndefined();
      expect(maliciousPayload._where).toBe('sleep(1000)');
      expect(maliciousPayload.nested.$gt).toBeUndefined();
      expect(maliciousPayload.nested._gt).toBe('');
      expect(maliciousPayload.nested['user.admin']).toBeUndefined();
      expect(maliciousPayload.nested.user_admin).toBe(true);
    });
  });

  describe('3. Counter Service (Atomic Sequence Generator)', () => {
    it('should generate sequential codes without year (AST-0001, AST-0002)', async () => {
      const counterKey = `test_asset_${Date.now()}`;
      const code1 = await getNextSequence(counterKey, { prefix: 'AST', pad: 4 });
      const code2 = await getNextSequence(counterKey, { prefix: 'AST', pad: 4 });

      expect(code1).toBe('AST-0001');
      expect(code2).toBe('AST-0002');
    });

    it('should generate sequential codes with year (EXP-2026-0001, INV-2026-0001)', async () => {
      const counterKey = `test_exp_${Date.now()}`;
      const code1 = await getNextSequence(counterKey, {
        prefix: 'EXP',
        pad: 4,
        includeYear: true,
        year: 2026,
      });
      const code2 = await getNextSequence(counterKey, {
        prefix: 'EXP',
        pad: 4,
        includeYear: true,
        year: 2026,
      });

      expect(code1).toBe('EXP-2026-0001');
      expect(code2).toBe('EXP-2026-0002');
    });

    it('peekSequence should read sequence without incrementing', async () => {
      const counterKey = `test_peek_${Date.now()}`;
      await getNextSequence(counterKey, { prefix: 'TKT', pad: 4 });
      const val1 = await peekSequence(counterKey);
      const val2 = await peekSequence(counterKey);

      expect(val1).toBe(1);
      expect(val2).toBe(1);
    });
  });

  describe('4. Encryption & Masking Helper (AES-256)', () => {
    it('should encrypt and decrypt plaintext accurately', () => {
      const plain = '1234-5678-9012-3456';
      const cipher = encrypt(plain);

      expect(cipher).toBeDefined();
      expect(cipher).not.toBe(plain);

      const decrypted = decrypt(cipher);
      expect(decrypted).toBe(plain);
    });

    it('should mask sensitive strings cleanly', () => {
      // Aadhaar masking
      expect(mask('123456789012', { visibleEnd: 4 })).toBe('********9012');
      // Bank account masking
      expect(mask('987654321098', { visibleEnd: 4 })).toBe('********1098');
      // PAN masking (e.g. ABCDE1234F -> ABCDE****F)
      expect(mask('ABCDE1234F', { visibleStart: 5, visibleEnd: 1 })).toBe('ABCDE****F');
    });
  });

  describe('5. Template Service (Handlebars with Variable Merge)', () => {
    it('should render custom template with formatPaise and formatDate helpers', () => {
      const template = 'Hello {{name}}, your salary is {{formatPaise amount}} on {{formatDate date}}';
      const result = renderTemplate(template, {
        name: 'Aurobinda',
        amount: 8500000,
        date: '2026-01-15T00:00:00Z',
      });

      expect(result).toContain('Hello Aurobinda');
      expect(result).toContain('85,000.00');
    });

    it('should render predefined OFFER_LETTER template', () => {
      const html = renderNamedTemplate('OFFER_LETTER', {
        candidateName: 'Priya Sharma',
        jobTitle: 'Senior UI/UX Designer',
        ctcPaise: 120000000,
        joiningDate: '2026-02-01T00:00:00Z',
        validDays: 7,
      });

      expect(html).toContain('Priya Sharma');
      expect(html).toContain('Senior UI/UX Designer');
      expect(html).toContain('12,00,000.00');
    });
  });

  describe('6. Excel & CSV Export Service', () => {
    const columns = [
      { header: 'Employee Code', key: 'code', width: 16 },
      { header: 'Full Name', key: 'name', width: 22 },
      { header: 'Department', key: 'department', width: 18 },
    ];
    const data = [
      { code: 'IDS001', name: 'Alok Patel', department: 'Executive' },
      { code: 'IDS002', name: 'Rohan Verma', department: 'Engineering' },
    ];

    it('should generate a non-empty Excel (.xlsx) buffer with styling', async () => {
      const buffer = await exportToExcel({
        title: 'Illusory Design Studios - Employee Register',
        columns,
        data,
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(1000);
    });

    it('should generate a non-empty CSV buffer', async () => {
      const buffer = await exportToCsv({ columns, data });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      const csvStr = buffer.toString('utf-8');
      expect(csvStr).toContain('Employee Code,Full Name,Department');
      expect(csvStr).toContain('IDS001,Alok Patel,Executive');
    });
  });

  describe('7. PDF Generation Service', () => {
    it('generateLetterPdf should return a valid PDF buffer', async () => {
      const buffer = await generateLetterPdf({
        title: 'EXPERIENCE CERTIFICATE',
        recipientName: 'Sneha Mohanty',
        recipientCode: 'IDS-042',
        contentParagraphs: [
          'This is to certify that Sneha Mohanty served as a Product Designer with Illusory Design Studios.',
          'During her tenure she demonstrated outstanding creativity and professionalism.',
        ],
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      // Valid PDF buffers always start with %PDF-
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generateInvoicePdf should return a valid PDF buffer', async () => {
      const buffer = await generateInvoicePdf({
        invoiceNumber: 'INV-2026-0042',
        client: { name: 'Acme Corp', company: 'Acme Technologies Ltd', gstin: '21ABCDE1234F1Z5' },
        items: [
          { description: 'UI/UX Redesign - Milestone 1', qty: 1, ratePaise: 25000000 },
        ],
        subtotalPaise: 25000000,
        taxPaise: 4500000,
        totalPaise: 29500000,
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('generatePayslipPdf should return a valid PDF buffer', async () => {
      const buffer = await generatePayslipPdf({
        employee: { name: 'Manoj Kumar', employeeId: 'IDS-018', designation: 'Developer' },
        monthYear: 'January 2026',
        earnings: [{ name: 'Basic Pay', amountPaise: 5000000 }],
        deductions: [{ name: 'PF Employee', amountPaise: 180000 }],
        grossPaise: 5000000,
        netPaise: 4820000,
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });
  });

  describe('8. Pagination & Filter Helper', () => {
    it('should parse valid pagination query parameters', () => {
      const { page, limit, skip, sort } = getPagination({ page: '2', limit: '15', sort: '-createdAt' });
      expect(page).toBe(2);
      expect(limit).toBe(15);
      expect(skip).toBe(15);
      expect(sort).toEqual({ createdAt: -1 });
    });

    it('should clamp invalid or excessive pagination parameters to sensible bounds', () => {
      const { page, limit, skip } = getPagination({ page: '-5', limit: '999' });
      expect(page).toBe(1);
      expect(limit).toBe(100); // Max limit clamp
      expect(skip).toBe(0);
    });

    it('buildPaginationResult should compute totalPages, hasNext, and hasPrev correctly', () => {
      const res = buildPaginationResult({
        page: 2,
        limit: 10,
        totalItems: 35,
        items: ['a', 'b'],
      });

      expect(res.pagination.totalItems).toBe(35);
      expect(res.pagination.totalPages).toBe(4);
      expect(res.pagination.hasNext).toBe(true);
      expect(res.pagination.hasPrev).toBe(true);
    });
  });

  describe('9. Email Service Fallback', () => {
    it('sendEmail should handle unconfigured SMTP gracefully without throwing', async () => {
      const res = await sendEmail({
        to: 'test@example.com',
        subject: 'Phase 0 Test',
        text: 'Testing graceful fallback',
      });

      expect(res.success).toBe(true);
      if (res.skipped) {
        expect(res.message).toBe('SMTP not configured');
      }
    });
  });
});
