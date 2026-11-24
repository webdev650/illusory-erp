import crypto from 'crypto';

/**
 * Whitelist of allowed template variable patterns
 */
export const ALLOWED_VARIABLE_PREFIXES = [
  'employee.',
  'company.',
  'signatory.',
  'letter.',
  'salary.',
  'custom.',
];

/**
 * Pre-validates template body to detect any unknown or misspelled variables
 */
export const validateTemplateVariables = (bodyText = '') => {
  const matches = bodyText.match(/\{\{([^}]+)\}\}/g) || [];
  const unknownVariables = [];

  for (const match of matches) {
    const varName = match.replace(/[{}]/g, '').trim();
    const isAllowed = ALLOWED_VARIABLE_PREFIXES.some((prefix) => varName.startsWith(prefix));
    if (!isAllowed) {
      unknownVariables.push(varName);
    }
  }

  return {
    isValid: unknownVariables.length === 0,
    unknownVariables,
  };
};

/**
 * Escapes HTML characters safely to prevent script and HTML injection
 */
export const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Strips dangerous HTML tags (scripts, iframes) to prevent XSS
 */
export const sanitizeTemplateHtml = (html = '') => {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
};

/**
 * Safely resolves and renders letter variables
 */
export const renderTemplateBody = (templateBodyOrOptions, maybeOptions = {}) => {
  let templateBody, employee, signatory, letter, extraFields, canReadSalary, customCompany;

  if (typeof templateBodyOrOptions === 'string') {
    templateBody = templateBodyOrOptions;
    employee = maybeOptions.employee;
    signatory = maybeOptions.signatory;
    letter = maybeOptions.letter;
    extraFields = maybeOptions.extraFields || maybeOptions.custom || {};
    canReadSalary = maybeOptions.canReadSalary || false;
    customCompany = maybeOptions.company;
  } else {
    ({
      templateBody,
      employee,
      signatory,
      letter,
      extraFields = {},
      canReadSalary = false,
      company: customCompany,
    } = templateBodyOrOptions || {});
  }

  const context = {
    'company.name': customCompany?.name || 'ILLUSORY DESIGN STUDIOS PVT. LTD.',
    'company.address': customCompany?.address || 'DLF Cybercity, Patia, Bhubaneswar, Odisha - 751024, India',
    'company.cin': customCompany?.cin || 'U72900OR2024PTC045123',
    'company.gstin': customCompany?.gstin || '21ABCDE1234F1Z5',
    'company.email': customCompany?.email || 'contact@illusorydesignstudios.com',
    'company.website': customCompany?.website || 'https://illusorydesignstudios.com',

    'signatory.name': signatory?.name || 'Aparna Tripathy',
    'signatory.designation': signatory?.designation || 'Managing Director',

    'letter.refNo': letter?.refNo || 'IDS/HR/DRAFT',
    'letter.date': letter?.date ? new Date(letter.date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
  };

  if (employee) {
    context['employee.fullName'] = employee.fullName || `${employee.personal?.firstName || ''} ${employee.personal?.lastName || ''}`.trim();
    context['employee.code'] = employee.employeeId || employee.code || '';
    context['employee.designation'] = employee.designation || employee.employment?.designation || '';
    context['employee.department'] = employee.department || employee.employment?.department?.name || 'General';
    context['employee.joiningDate'] = employee.joiningDate || (employee.employment?.dateOfJoining
      ? new Date(employee.employment.dateOfJoining).toLocaleDateString('en-IN')
      : 'N/A');
    context['employee.dateOfJoining'] = context['employee.joiningDate'];
    context['employee.lastWorkingDay'] = employee.lastWorkingDay || (employee.exit?.lastWorkingDay
      ? new Date(employee.exit.lastWorkingDay).toLocaleDateString('en-IN')
      : 'N/A');
    context['employee.manager'] = employee.employment?.reportingManager
      ? `${employee.employment.reportingManager.personal?.firstName || ''} ${employee.employment.reportingManager.personal?.lastName || ''}`.trim()
      : 'Studio Management';
  }

  // Salary variables: Restricted to employee.readSalary
  if (canReadSalary && employee?.salary?.ctc) {
    context['salary.ctc'] = `₹ ${(employee.salary.ctc).toLocaleString('en-IN')}`;
    context['salary.basic'] = `₹ ${(employee.salary.basic || 0).toLocaleString('en-IN')}`;
  } else {
    context['salary.ctc'] = 'Managed in Payroll';
    context['salary.basic'] = 'Managed in Payroll';
  }

  // Extra / Custom fields
  Object.keys(extraFields).forEach((key) => {
    context[`custom.${key}`] = extraFields[key];
    context[key] = extraFields[key]; // direct fallback
  });

  // Replace each {{variable}}
  let rendered = templateBody || '';
  Object.keys(context).forEach((varKey) => {
    const escapedVal = escapeHtml(context[varKey]);
    const regex = new RegExp(`\\{\\{\\s*${varKey}\\s*\\}\\}`, 'g');
    rendered = rendered.replace(regex, escapedVal);
  });

  return rendered;
};

/**
 * Computes SHA-256 document hash for immutability and tamper-evidence
 */
export const computeDocumentHash = (content) => {
  return crypto.createHash('sha256').update(content).digest('hex');
};

export const generateDocumentHash = computeDocumentHash;
