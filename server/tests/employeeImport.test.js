import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import '../src/config/envValidator.js';
import { connectDB } from '../src/config/db.js';
import {
  cleanEmployeeCode,
  normalizePhone,
  normalizeBloodGroup,
  normalizeMaritalStatus,
  normalizeState,
  normalizeNoticePeriod,
  normalizeEmploymentTypeAndStatus,
  validateAadhaar,
  validatePan,
  validateIfsc,
  generateSecureTempPassword,
  previewEmployeeImport,
  SHEET_ROLE_MAPPING,
} from '../src/services/employeeImport.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('EMPLOYEE EXCEL IMPORT — CLEANING RULES & VALIDATIONS', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
  });
  describe('1. Employee Code & Bracket Removal', () => {
    it('should strip surrounding brackets from codes like (IDS-E25-CR001)', () => {
      expect(cleanEmployeeCode('(IDS-E25-CR001)')).toBe('IDS-E25-CR001');
      expect(cleanEmployeeCode('(IDS-E2026-DE001)')).toBe('IDS-E2026-DE001');
      expect(cleanEmployeeCode('IDS-E24-EX002')).toBe('IDS-E24-EX002');
      expect(cleanEmployeeCode('  (IDS-001)  ')).toBe('IDS-001');
    });

    it('should handle empty or null codes gracefully', () => {
      expect(cleanEmployeeCode('')).toBe('');
      expect(cleanEmployeeCode(null)).toBe('');
      expect(cleanEmployeeCode(undefined)).toBe('');
    });
  });

  describe('2. Phone Number Normalization', () => {
    it('should keep standard 10-digit mobile numbers intact', () => {
      const res = normalizePhone('7848873370');
      expect(res.isValid).toBe(true);
      expect(res.phone).toBe('7848873370');
    });

    it('should strip leading 91 from 12-digit numbers', () => {
      const res = normalizePhone('917328003600');
      expect(res.isValid).toBe(true);
      expect(res.phone).toBe('7328003600');
    });

    it('should strip spaces and dashes from phone numbers', () => {
      const res = normalizePhone('+91 73280-03600');
      expect(res.isValid).toBe(true);
      expect(res.phone).toBe('7328003600');
    });

    it('should flag numbers that do not yield 10 digits as invalid', () => {
      const res = normalizePhone('12345');
      expect(res.isValid).toBe(false);
      expect(res.phone).toBe('12345');
    });
  });

  describe('3. State, Blood Group & Marital Status Normalization', () => {
    it('should normalize Odhisha to Odisha', () => {
      expect(normalizeState('Odhisha')).toBe('Odisha');
      expect(normalizeState('odhisha ')).toBe('Odisha');
      expect(normalizeState('Odisha')).toBe('Odisha');
    });

    it('should normalize blood groups with +ve to standard +', () => {
      expect(normalizeBloodGroup('B +ve')).toBe('B+');
      expect(normalizeBloodGroup('O +ve')).toBe('O+');
      expect(normalizeBloodGroup('A +ve')).toBe('A+');
      expect(normalizeBloodGroup('B+')).toBe('B+');
      expect(normalizeBloodGroup('Invalid')).toBe('Unknown');
      expect(normalizeBloodGroup('NA')).toBe('Unknown');
    });

    it('should normalize marital status to Single, Married, etc.', () => {
      expect(normalizeMaritalStatus('single')).toBe('Single');
      expect(normalizeMaritalStatus('unmarried')).toBe('Single');
      expect(normalizeMaritalStatus('Unmarried')).toBe('Single');
      expect(normalizeMaritalStatus('Married')).toBe('Married');
    });
  });

  describe('4. Statutory & Bank Validations (Aadhaar, PAN, IFSC)', () => {
    it('validateAadhaar should require exactly 12 digits', () => {
      expect(validateAadhaar('341492494993').valid).toBe(true);
      expect(validateAadhaar('3414 9249 4993').valid).toBe(true);
      expect(validateAadhaar('12345').valid).toBe(false);
      expect(validateAadhaar('').valid).toBe(true); // Empty is treated as valid (optional field)
    });

    it('validatePan should require standard regex AAAAA9999A', () => {
      expect(validatePan('IZSPD0168P').valid).toBe(true);
      expect(validatePan('LGCPK9810M').valid).toBe(true);
      expect(validatePan('INVALID123').valid).toBe(false);
      expect(validatePan('1234567890').valid).toBe(false);
    });

    it('validateIfsc should require standard regex AAAA0XXXXXX', () => {
      expect(validateIfsc('SBIN0018386').valid).toBe(true);
      expect(validateIfsc('IDIB000S231').valid).toBe(true);
      expect(validateIfsc('BKID0005165').valid).toBe(true);
      expect(validateIfsc('INVALIDIFSC').valid).toBe(false);
    });
  });

  describe('5. Notice Period & Employment Type Mapping', () => {
    it('normalizeNoticePeriod should parse number of days', () => {
      expect(normalizeNoticePeriod('30 days')).toBe(30);
      expect(normalizeNoticePeriod('15 days')).toBe(15);
      expect(normalizeNoticePeriod(60)).toBe(60);
      expect(normalizeNoticePeriod('')).toBe(30);
    });

    it('normalizeEmploymentTypeAndStatus should set probation status for PROBATION', () => {
      const probation = normalizeEmploymentTypeAndStatus('PROBATION');
      expect(probation.status).toBe('probation');
      expect(probation.employeeType).toBe('Full-Time');

      const fullTime = normalizeEmploymentTypeAndStatus('FULL TIME');
      expect(fullTime.status).toBe('active');
      expect(fullTime.employeeType).toBe('Full-Time');

      const intern = normalizeEmploymentTypeAndStatus('INTERN');
      expect(intern.employeeType).toBe('Intern');
    });
  });

  describe('6. Sheet to ERP Role Mapping', () => {
    it('should map Employee sheet to employee role', () => {
      expect(SHEET_ROLE_MAPPING['employee']).toBe('employee');
    });

    it('should map Admin sheet to hr role', () => {
      expect(SHEET_ROLE_MAPPING['admin']).toBe('hr');
    });

    it('should map Super Admin sheet to super_admin role', () => {
      expect(SHEET_ROLE_MAPPING['super admin']).toBe('super_admin');
    });
  });

  describe('7. Secure Password Generation', () => {
    it('should generate a 14-character unique password with upper, lower, numbers, and symbols', () => {
      const pwd1 = generateSecureTempPassword();
      const pwd2 = generateSecureTempPassword();

      expect(pwd1.length).toBe(14);
      expect(pwd2.length).toBe(14);
      expect(pwd1).not.toBe(pwd2);
      expect(pwd1).not.toBe('ChangeMe@123');

      // Check complexity
      expect(/[A-Z]/.test(pwd1)).toBe(true);
      expect(/[a-z]/.test(pwd1)).toBe(true);
      expect(/[0-9]/.test(pwd1)).toBe(true);
      expect(/[!@#$%^&*]/.test(pwd1)).toBe(true);
    });
  });

  describe('8. Dry-Run Workbook Preview', () => {
    it('should preview real CRM_IDS_EMPLOYEE_DATA.xlsx file accurately', async () => {
      const filePath = path.resolve(__dirname, '../data/imports/CRM_IDS_EMPLOYEE_DATA.xlsx');
      const preview = await previewEmployeeImport(filePath);

      expect(preview.totalRows).toBe(9); // 7 employees + 1 admin + 1 super admin
      expect(preview.sheets.length).toBe(3);

      const empSheet = preview.sheets.find((s) => s.sheetName === 'Employee');
      expect(empSheet.rows.length).toBe(7);
      expect(empSheet.role).toBe('employee');

      const adminSheet = preview.sheets.find((s) => s.sheetName === 'Admin');
      expect(adminSheet.rows.length).toBe(1);
      expect(adminSheet.role).toBe('hr');

      const superAdminSheet = preview.sheets.find((s) => s.sheetName === 'Super Admin');
      expect(superAdminSheet.rows.length).toBe(1);
      expect(superAdminSheet.role).toBe('super_admin');

      // Check Aparna's email extracted from hyperlink
      const aparna = superAdminSheet.rows[0];
      expect(aparna.officialEmail).toBe('operations@illusorydesignstudios.com');
      expect(aparna.employeeCode).toBe('IDS-E24-EX002');

      // Check bracket removal on Mihir
      const mihir = empSheet.rows[0];
      expect(mihir.employeeCode).toBe('IDS-E25-CR001');
    });
  });
});
