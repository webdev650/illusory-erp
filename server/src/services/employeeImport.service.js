import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Department } from '../models/Department.js';
import { encrypt, mask } from '../utils/crypto.js';
import { logAudit } from '../middleware/audit.js';
import { logger } from '../utils/logger.js';

/**
 * Standard Sheet Name to Role Mapping
 */
export const SHEET_ROLE_MAPPING = {
  employee: 'employee',
  admin: 'hr',
  'super admin': 'super_admin',
};

/**
 * Pre-defined department list with default codes
 */
const DEPARTMENT_DEFAULTS = {
  Growth: 'GRW',
  Designing: 'DES',
  Development: 'DEV',
  Creative: 'CRT',
  Marketing: 'MKT',
  'Sales & Business Development': 'SBD',
  HR: 'HRD',
  'Management & Operations': 'OPS',
  Design: 'DES',
  Admin: 'ADM',
  Finance: 'FIN',
};

/**
 * Clean and extract cell value as string, resolving hyperlinks and formulas
 */
export const extractCellText = (cell, isEmailField = false) => {
  if (!cell || cell.value === null || cell.value === undefined) return '';

  const val = cell.value;

  // Handle ExcelJS Hyperlink object (e.g. { text: 'Aparna Tripathy', hyperlink: 'mailto:operations@...' })
  if (typeof val === 'object' && val !== null) {
    if (val.hyperlink) {
      const link = String(val.hyperlink).trim();
      if (link.toLowerCase().startsWith('mailto:')) {
        const mail = link.replace(/^mailto:/i, '').trim();
        if (isEmailField || mail.includes('@')) return mail;
      }
      if (isEmailField) return link;
    }
    if (val.text) {
      const txt = String(val.text).trim();
      if (isEmailField && txt.includes('@')) return txt;
      if (!isEmailField) return txt;
    }
    if (val.result !== undefined && val.result !== null) {
      return String(val.result).trim();
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    return '';
  }

  const str = String(val).trim();
  // Standard empty representations
  if (['-', 'NA', 'N/A', 'N / A', 'NONE', 'NULL', ''].includes(str.toUpperCase())) {
    return '';
  }
  return str;
};

/**
 * Remove surrounding brackets from custom employee codes
 * e.g. (IDS-E25-CR001) -> IDS-E25-CR001
 */
export const cleanEmployeeCode = (rawCode) => {
  if (!rawCode) return '';
  return String(rawCode).trim().replace(/^[\s(]+|[\s)]+$/g, '').trim();
};

/**
 * Normalize Indian state name
 */
export const normalizeState = (rawState) => {
  if (!rawState) return 'Odisha';
  const clean = String(rawState).trim();
  if (/^odhi?sha$/i.test(clean)) return 'Odisha';
  return clean;
};

/**
 * Normalize blood group
 * e.g. "B +ve" -> "B+", "O +ve" -> "O+"
 */
export const normalizeBloodGroup = (rawBg) => {
  if (!rawBg) return 'Unknown';
  let clean = String(rawBg).trim().toUpperCase();
  clean = clean.replace(/\s*\+VE/g, '+').replace(/\s*-VE/g, '-').replace(/\s+/g, '');
  const allowed = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  return allowed.includes(clean) ? clean : 'Unknown';
};

/**
 * Normalize marital status
 */
export const normalizeMaritalStatus = (rawMs) => {
  if (!rawMs) return 'Single';
  const clean = String(rawMs).trim().toLowerCase();
  if (clean === 'single' || clean === 'unmarried') return 'Single';
  if (clean === 'married') return 'Married';
  if (clean === 'divorced') return 'Divorced';
  if (clean === 'widowed') return 'Widowed';
  return 'Other';
};

/**
 * Normalize phone numbers to exact 10 digits
 */
export const normalizePhone = (rawPhone) => {
  if (!rawPhone) return { phone: '', isValid: false };
  let digits = String(rawPhone).replace(/\D/g, '');
  // If 12 digits starting with 91, strip 91 country code
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  return {
    phone: digits,
    isValid: digits.length === 10,
  };
};

/**
 * Parse date from Excel dates, ISO strings, or DD-MM-YYYY
 */
export const parseExcelDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  const str = String(val).trim();
  // Check DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)));
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Parse notice period string e.g. "30 days" -> 30
 */
export const normalizeNoticePeriod = (val) => {
  if (!val) return 30;
  const match = String(val).match(/\d+/);
  return match ? parseInt(match[0], 10) : 30;
};

/**
 * Normalize employment type and employee status
 */
export const normalizeEmploymentTypeAndStatus = (rawType, rawEmployeeIntern) => {
  const typeStr = (rawType || rawEmployeeIntern || 'FULL TIME').toUpperCase().trim();

  let employeeType = 'Full-Time';
  let status = 'active';

  if (typeStr.includes('PROBATION')) {
    employeeType = 'Full-Time';
    status = 'probation';
  } else if (typeStr.includes('INTERN')) {
    employeeType = 'Intern';
    status = 'active';
  } else if (typeStr.includes('PART')) {
    employeeType = 'Part-Time';
  } else if (typeStr.includes('CONTRACT')) {
    employeeType = 'Contract';
  }

  return { employeeType, status };
};

/**
 * Validate Aadhaar (12 digits)
 */
export const validateAadhaar = (val) => {
  if (!val) return { valid: true, value: '' };
  const digits = String(val).replace(/\D/g, '');
  return {
    valid: digits.length === 12,
    value: digits,
  };
};

/**
 * Validate PAN (AAAAA9999A)
 */
export const validatePan = (val) => {
  if (!val) return { valid: true, value: '' };
  const clean = String(val).trim().toUpperCase();
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return {
    valid: panRegex.test(clean),
    value: clean,
  };
};

/**
 * Validate IFSC code (AAAA0XXXXXX)
 */
export const validateIfsc = (val) => {
  if (!val) return { valid: true, value: '' };
  const clean = String(val).trim().toUpperCase();
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return {
    valid: ifscRegex.test(clean),
    value: clean,
  };
};

/**
 * Generate a strong random temporary password (14 characters)
 */
export const generateSecureTempPassword = () => {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;

  let pwd = '';
  pwd += uppercase[crypto.randomInt(0, uppercase.length)];
  pwd += lowercase[crypto.randomInt(0, lowercase.length)];
  pwd += numbers[crypto.randomInt(0, numbers.length)];
  pwd += symbols[crypto.randomInt(0, symbols.length)];

  for (let i = 4; i < 14; i++) {
    pwd += allChars[crypto.randomInt(0, allChars.length)];
  }

  // Shuffle characters
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Find or create department record by name (case-insensitive)
 */
export const findOrCreateDepartment = async (deptName) => {
  if (!deptName) deptName = 'General';
  const clean = deptName.trim();
  const normalizedName = clean.toLowerCase() === 'designing' ? 'Design' : clean;

  let dept = await Department.findOne({
    $or: [
      { name: { $regex: new RegExp(`^${clean}$`, 'i') } },
      { name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } },
    ],
  });

  if (!dept) {
    let code =
      DEPARTMENT_DEFAULTS[clean] ||
      DEPARTMENT_DEFAULTS[normalizedName] ||
      clean
        .split(/\s+/)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 4) ||
      'GEN';

    // Ensure code uniqueness
    let existingCode = await Department.findOne({ code });
    let counter = 1;
    while (existingCode) {
      code = `${code.slice(0, 3)}${counter}`;
      existingCode = await Department.findOne({ code });
      counter++;
    }

    dept = await Department.create({
      name: clean,
      code,
      description: `${clean} department of Illusory Design Studios`,
    });
  }
  return dept;
};

/**
 * Parse an Excel file workbook into raw row objects matched by header name
 */
export const parseExcelFile = async (filePathOrBuffer) => {
  const workbook = new ExcelJS.Workbook();
  if (Buffer.isBuffer(filePathOrBuffer)) {
    await workbook.xlsx.load(filePathOrBuffer);
  } else {
    await workbook.xlsx.readFile(filePathOrBuffer);
  }

  const parsedSheets = [];

  workbook.eachSheet((worksheet) => {
    const sheetName = worksheet.name.trim();
    const sheetKey = sheetName.toLowerCase();
    const roleKey = SHEET_ROLE_MAPPING[sheetKey] || 'employee';

    const headerRow = worksheet.getRow(1);
    const colIndexToHeader = {};

    headerRow.eachCell((cell, colNumber) => {
      const headerText = String(cell.value || '').trim();
      if (headerText) {
        colIndexToHeader[colNumber] = headerText;
      }
    });

    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rowData = {};
      let hasData = false;

      Object.entries(colIndexToHeader).forEach(([colNumber, headerName]) => {
        const cell = row.getCell(parseInt(colNumber, 10));
        const isEmailField = /email/i.test(headerName);
        const textVal = extractCellText(cell, isEmailField);
        rowData[headerName] = textVal;
        if (textVal) hasData = true;
      });

      if (hasData) {
        rows.push({
          rowNumber,
          data: rowData,
        });
      }
    });

    parsedSheets.push({
      sheetName,
      roleKey,
      rows,
    });
  });

  return parsedSheets;
};

/**
 * Preview / Dry-Run Employee Import
 */
export const previewEmployeeImport = async (filePathOrBuffer) => {
  const parsedSheets = await parseExcelFile(filePathOrBuffer);

  const previewResults = [];
  const warningsList = [];
  const errorsList = [];

  let totalRows = 0;
  let willCreateCount = 0;
  let willUpdateCount = 0;
  let skippedCount = 0;

  // Cache existing employees for duplicate checks
  const existingEmployees = await Employee.find({}, 'employeeId personal.officialEmail');
  const existingCodeMap = new Set(existingEmployees.map((e) => (e.employeeId || '').toUpperCase()));
  const existingEmailMap = new Set(
    existingEmployees.map((e) => (e.personal?.officialEmail || '').toLowerCase())
  );

  const processedCodes = new Set();
  const processedEmails = new Set();

  for (const sheet of parsedSheets) {
    const sheetPreview = {
      sheetName: sheet.sheetName,
      role: sheet.roleKey,
      rows: [],
    };

    for (const item of sheet.rows) {
      totalRows++;
      const r = item.data;
      const rowNum = item.rowNumber;
      const rowWarnings = [];
      const rowErrors = [];

      // Extract and clean key fields
      const employeeCode = cleanEmployeeCode(r['Custom Employee Code'] || r['Bio Metric ID']);
      const officialEmail = (r['Work Email ID'] || r['Personal Email ID'] || '').toLowerCase();
      const displayName = r['Display Name'] || `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim();
      const firstName = r['First Name'] || displayName.split(' ')[0] || 'Unknown';
      const lastName = r['Last Name'] || (displayName.split(' ').slice(1).join(' ') || '-');
      const designation = r['Designation'] || r['User Role'] || 'Team Member';
      const departmentName = r['Department'] || 'General';

      if (!employeeCode) {
        rowErrors.push('Missing Custom Employee Code');
      } else if (processedCodes.has(employeeCode.toUpperCase())) {
        rowErrors.push(`Duplicate Employee Code "${employeeCode}" within import file`);
      } else {
        processedCodes.add(employeeCode.toUpperCase());
      }

      if (!officialEmail) {
        rowErrors.push('Missing Work Email ID');
      } else if (!officialEmail.includes('@')) {
        rowErrors.push(`Invalid Work Email format "${officialEmail}"`);
      } else if (processedEmails.has(officialEmail)) {
        rowErrors.push(`Duplicate Work Email "${officialEmail}" within import file`);
      } else {
        processedEmails.add(officialEmail);
      }

      // Validations and Warnings
      const contactCheck = normalizePhone(r['Contact'] || r['Work Phone']);
      if (!contactCheck.isValid && (r['Contact'] || r['Work Phone'])) {
        rowWarnings.push(`Contact phone "${r['Contact'] || r['Work Phone']}" is not a valid 10-digit mobile number.`);
      }

      const aadhaarCheck = validateAadhaar(r['Aadhaar Number']);
      if (!aadhaarCheck.valid && r['Aadhaar Number']) {
        rowWarnings.push(`Aadhaar "${mask(r['Aadhaar Number'])}" is not 12 digits.`);
      }

      const panCheck = validatePan(r['Pan Number']);
      if (!panCheck.valid && r['Pan Number']) {
        rowWarnings.push(`PAN "${mask(r['Pan Number'], 2, 1)}" does not match pattern AAAAA9999A.`);
      }

      const ifscCheck = validateIfsc(r['IFSC code']);
      if (!ifscCheck.valid && r['IFSC code']) {
        rowWarnings.push(`IFSC "${mask(r['IFSC code'], 4, 2)}" does not match standard pattern AAAA0XXXXXX.`);
      }

      if (r['Password']) {
        rowWarnings.push('Pre-filled password in file ignored. A unique secure temporary password will be generated.');
      }

      const reportTo = r['Report To'];
      if (reportTo) {
        rowWarnings.push(`Manager: "${reportTo}" (will be linked during pass 2 if found).`);
      }

      // Check if existing in database
      const isExisting =
        existingCodeMap.has(employeeCode.toUpperCase()) || existingEmailMap.has(officialEmail);

      let action = 'CREATE';
      if (rowErrors.length > 0) {
        action = 'SKIP_ERROR';
        skippedCount++;
      } else if (isExisting) {
        action = 'UPDATE';
        willUpdateCount++;
      } else {
        willCreateCount++;
      }

      const rowSummary = {
        rowNumber: rowNum,
        sheetName: sheet.sheetName,
        action,
        employeeCode,
        displayName,
        firstName,
        lastName,
        officialEmail,
        department: departmentName,
        designation,
        role: sheet.roleKey,
        phone: contactCheck.phone,
        reportTo,
        warnings: rowWarnings,
        errors: rowErrors,
      };

      sheetPreview.rows.push(rowSummary);
      if (rowWarnings.length) warningsList.push({ rowNumber: rowNum, sheet: sheet.sheetName, employee: displayName, warnings: rowWarnings });
      if (rowErrors.length) errorsList.push({ rowNumber: rowNum, sheet: sheet.sheetName, employee: displayName, errors: rowErrors });
    }

    previewResults.push(sheetPreview);
  }

  return {
    totalRows,
    willCreateCount,
    willUpdateCount,
    skippedCount,
    warningsCount: warningsList.length,
    errorsCount: errorsList.length,
    sheets: previewResults,
    warningsList,
    errorsList,
  };
};

/**
 * Commit Employee Import to Database
 */
export const commitEmployeeImport = async (
  filePathOrBuffer,
  options = { overwrite: false, actorUser: null }
) => {
  const parsedSheets = await parseExcelFile(filePathOrBuffer);

  const reportRecords = [];
  const managersToResolve = [];
  const managersNotFound = [];

  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // Pre-load roles
  const roles = await Role.find({});
  const roleMap = {};
  roles.forEach((r) => {
    roleMap[r.key] = r._id;
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportsDir = path.resolve(__dirname, '../../data/imports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // --- PASS 1: Create / Update Employees & Users ---
  for (const sheet of parsedSheets) {
    const roleKey = sheet.roleKey;
    const roleId = roleMap[roleKey] || roleMap['employee'];

    for (const item of sheet.rows) {
      const r = item.data;
      const rowNum = item.rowNumber;

      const employeeCode = cleanEmployeeCode(r['Custom Employee Code'] || r['Bio Metric ID']);
      const officialEmail = (r['Work Email ID'] || r['Personal Email ID'] || '').toLowerCase();
      const displayName = r['Display Name'] || `${r['First Name'] || ''} ${r['Last Name'] || ''}`.trim();

      if (!employeeCode || !officialEmail) {
        skippedCount++;
        continue;
      }

      try {
        const department = await findOrCreateDepartment(r['Department'] || 'General');

        const { employeeType, status } = normalizeEmploymentTypeAndStatus(
          r['Employment Type'],
          r['Type (Employee/Intern)']
        );

        const contactPhone = normalizePhone(r['Contact'] || r['Work Phone']).phone || '9999999999';
        const personalEmail = (r['Personal Email ID'] || '').toLowerCase();
        const joiningDate = parseExcelDate(r['Joining Date']) || new Date();
        const dob = parseExcelDate(r['Date Of Birth']);
        const bloodGroup = normalizeBloodGroup(r['Blood Group']);
        const maritalStatus = normalizeMaritalStatus(r['Marrital Status']);
        const state = normalizeState(r['State']);
        const noticePeriodDays = normalizeNoticePeriod(r['Notice Period']);

        // Encrypt sensitive statutory & bank numbers
        const rawAadhaar = validateAadhaar(r['Aadhaar Number']).value;
        const rawPan = validatePan(r['Pan Number']).value;
        const rawAccNumber = String(r['Account Number'] || '').replace(/\D/g, '');

        const encryptedAadhaar = rawAadhaar ? encrypt(rawAadhaar) : '';
        const encryptedPan = rawPan ? encrypt(rawPan) : '';
        const encryptedBankAcc = rawAccNumber ? encrypt(rawAccNumber) : '';

        // Check if employee already exists
        let employee = await Employee.findOne({
          $or: [{ employeeId: employeeCode }, { 'personal.officialEmail': officialEmail }],
        });

        let actionTaken = 'CREATED';
        let temporaryPassword = '';

        if (employee) {
          actionTaken = 'UPDATED';
          updatedCount++;

          // Update non-empty fields or overwrite
          if (options.overwrite) {
            employee.personal.firstName = r['First Name'] || displayName.split(' ')[0];
            employee.personal.lastName = r['Last Name'] || displayName.split(' ').slice(1).join(' ') || '-';
            employee.personal.phone = contactPhone;
            employee.employment.department = department._id;
            employee.employment.designation = r['Designation'] || r['User Role'] || 'Team Member';
            employee.employment.noticePeriodDays = noticePeriodDays;
            if (encryptedAadhaar) employee.statutory.aadhaar = encryptedAadhaar;
            if (encryptedPan) employee.statutory.pan = encryptedPan;
            if (encryptedBankAcc) employee.bank.accountNumber = encryptedBankAcc;
          } else {
            // Fill only empty fields
            if (!employee.personal.phone && contactPhone) employee.personal.phone = contactPhone;
            if (!employee.personal.personalEmail && personalEmail) employee.personal.personalEmail = personalEmail;
            if (!employee.statutory.aadhaar && encryptedAadhaar) employee.statutory.aadhaar = encryptedAadhaar;
            if (!employee.statutory.pan && encryptedPan) employee.statutory.pan = encryptedPan;
            if (!employee.bank.accountNumber && encryptedBankAcc) employee.bank.accountNumber = encryptedBankAcc;
          }
          await employee.save();
        } else {
          actionTaken = 'CREATED';
          createdCount++;

          // Create fresh Employee record
          employee = await Employee.create({
            employeeId: employeeCode,
            status,
            personal: {
              firstName: r['First Name'] || displayName.split(' ')[0],
              lastName: r['Last Name'] || displayName.split(' ').slice(1).join(' ') || '-',
              gender: /female/i.test(r['Gender']) ? 'Female' : /male/i.test(r['Gender']) ? 'Male' : 'Other',
              dob,
              bloodGroup,
              maritalStatus,
              phone: contactPhone,
              personalEmail,
              officialEmail,
              currentAddress: {
                line1: r['Current Address'] || '',
                city: r['City'] || 'Bhubaneswar',
                state,
                pincode: String(r['Pincode'] || ''),
                country: r['Country'] || 'India',
              },
              permanentAddress: {
                line1: r['Permanent Address'] || r['Current Address'] || '',
                city: r['City'] || 'Bhubaneswar',
                state,
                pincode: String(r['Pincode'] || ''),
                country: r['Country'] || 'India',
              },
            },
            emergencyContacts: r['Emergency contant person']
              ? [
                  {
                    name: r['Emergency contant person'],
                    relation: r['Relation With'] || r['Relation With '] || 'Family',
                    phone: normalizePhone(r['Emergency Contact Number']).phone || contactPhone,
                  },
                ]
              : [],
            employment: {
              dateOfJoining: joiningDate,
              employeeType,
              department: department._id,
              designation: r['Designation'] || r['User Role'] || 'Team Member',
              noticePeriodDays,
            },
            statutory: {
              aadhaar: encryptedAadhaar,
              pan: encryptedPan,
              uan: r['UAN Number'] || '',
            },
            bank: {
              accountHolder: r['Account Holder Name'] || displayName,
              bankName: r['Bank Name'] || '',
              accountNumber: encryptedBankAcc,
              ifsc: r['IFSC code'] || '',
            },
            isDemo: false,
          });

          // Generate unique strong random password and create linked User
          temporaryPassword = generateSecureTempPassword();
          const passwordHash = await User.hashPassword(temporaryPassword);

          await User.findOneAndUpdate(
            { email: officialEmail },
            {
              email: officialEmail,
              passwordHash,
              role: roleId,
              employee: employee._id,
              isActive: true,
              mustChangePassword: true,
              isDemo: false,
            },
            { upsert: true, new: true }
          );
        }

        // Store manager linking intention for Pass 2
        const reportToName = r['Report To'];
        if (reportToName) {
          managersToResolve.push({
            employeeId: employee._id,
            employeeCode,
            displayName,
            reportToName: reportToName.trim(),
          });
        }

        reportRecords.push({
          row: rowNum,
          sheet: sheet.sheetName,
          action: actionTaken,
          employeeCode,
          name: displayName,
          officialEmail,
          role: roleKey,
          temporaryPassword: temporaryPassword || '(Unchanged)',
          aadhaarLast4: rawAadhaar ? rawAadhaar.slice(-4) : '-',
          panLast4: rawPan ? rawPan.slice(-4) : '-',
          bankLast4: rawAccNumber ? rawAccNumber.slice(-4) : '-',
        });
      } catch (rowErr) {
        logger.error({ rowErr, rowNum, employeeCode }, 'Failed to import row');
        skippedCount++;
      }
    }
  }

  // --- PASS 2: Link Reporting Managers by Display Name ---
  const allEmployees = await Employee.find({}, '_id employeeId personal.firstName personal.lastName');
  const employeeNameLookup = new Map();

  allEmployees.forEach((emp) => {
    const fn = (emp.personal?.firstName || '').trim();
    const ln = (emp.personal?.lastName || '').trim();
    const full = `${fn} ${ln}`.trim().toLowerCase();
    employeeNameLookup.set(full, emp._id);
    if (fn) employeeNameLookup.set(fn.toLowerCase(), emp._id);
  });

  for (const item of managersToResolve) {
    const targetName = item.reportToName.toLowerCase();
    const managerId = employeeNameLookup.get(targetName);

    if (managerId && String(managerId) !== String(item.employeeId)) {
      await Employee.findByIdAndUpdate(item.employeeId, {
        'employment.reportingManager': managerId,
      });
    } else {
      managersNotFound.push({
        employeeCode: item.employeeCode,
        employeeName: item.displayName,
        managerName: item.reportToName,
      });
    }
  }

  // --- Generate CSV Report File ---
  const reportFileName = `import-report-${timestamp}.csv`;
  const reportFilePath = path.join(reportsDir, reportFileName);

  const csvHeaders = [
    'Row',
    'Sheet',
    'Action',
    'Employee Code',
    'Full Name',
    'Official Email',
    'ERP Role',
    'Temporary Password',
    'Aadhaar (Last 4)',
    'PAN (Last 4)',
    'Bank Acc (Last 4)',
  ];

  const csvRows = reportRecords.map((rec) =>
    [
      rec.row,
      `"${rec.sheet}"`,
      rec.action,
      `"${rec.employeeCode}"`,
      `"${rec.name}"`,
      rec.officialEmail,
      rec.role,
      `"${rec.temporaryPassword}"`,
      rec.aadhaarLast4,
      rec.panLast4,
      rec.bankLast4,
    ].join(',')
  );

  fs.writeFileSync(reportFilePath, [csvHeaders.join(','), ...csvRows].join('\n'), 'utf-8');

  // --- Log Audit Trail ---
  if (options.actorUser) {
    await logAudit({
      req: { user: options.actorUser, ip: '127.0.0.1' },
      action: 'EMPLOYEE_EXCEL_IMPORT',
      entity: 'Employee',
      changes: {
        createdCount,
        updatedCount,
        skippedCount,
        reportFile: reportFileName,
      },
    });
  }

  return {
    success: true,
    createdCount,
    updatedCount,
    skippedCount,
    totalProcessed: reportRecords.length,
    reportFilePath,
    reportFileName,
    records: reportRecords,
    managersNotFound,
  };
};

export default {
  previewEmployeeImport,
  commitEmployeeImport,
  cleanEmployeeCode,
  normalizePhone,
  validatePan,
  validateAadhaar,
  validateIfsc,
  generateSecureTempPassword,
};
