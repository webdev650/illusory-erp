// Helper to mask sensitive string data
export const maskAadhaar = (val) => {
  if (!val || val.length < 4) return val;
  const last4 = val.slice(-4);
  return `XXXX-XXXX-${last4}`;
};

export const maskPan = (val) => {
  if (!val || val.length < 4) return val;
  return `${val.slice(0, 3)}****${val.slice(-1)}`;
};

export const maskBankAcc = (val) => {
  if (!val || val.length < 4) return val;
  const last4 = val.slice(-4);
  return `${'X'.repeat(Math.max(val.length - 4, 4))}${last4}`;
};

/**
 * Sanitizes an employee object before sending it to the client.
 * Enforces role and permission boundaries:
 * - employee.readSalary: controls salary visibility
 * - employee.readStatutory: controls statutory and bank details visibility
 * - isSelf: employees can see their own masked details
 */
export const sanitizeEmployee = (employee, userPermissions = [], isSelf = false) => {
  if (!employee) return null;
  const emp = employee.toObject ? employee.toObject() : { ...employee };

  const canReadSalary = userPermissions.includes('*') || userPermissions.includes('employee.readSalary');
  const canReadStatutory = userPermissions.includes('*') || userPermissions.includes('employee.readStatutory');

  // Salary protection
  if (!canReadSalary && !isSelf) {
    delete emp.salary;
  }

  // Statutory protection: mask for self and restricted admins, hide for unauthorized
  if (!canReadStatutory && !isSelf) {
    delete emp.statutory;
    delete emp.bank;
  } else if (!canReadStatutory && isSelf) {
    // Masked for self
    if (emp.statutory) {
      emp.statutory = {
        aadhaar: maskAadhaar(emp.statutory.aadhaar),
        pan: maskPan(emp.statutory.pan),
        uan: emp.statutory.uan ? `XXXX${emp.statutory.uan.slice(-4)}` : '',
        esiNumber: emp.statutory.esiNumber ? `XXXX${emp.statutory.esiNumber.slice(-4)}` : '',
      };
    }
    if (emp.bank) {
      emp.bank = {
        accountHolder: emp.bank.accountHolder,
        bankName: emp.bank.bankName,
        accountNumber: maskBankAcc(emp.bank.accountNumber),
        ifsc: emp.bank.ifsc,
      };
    }
  }

  return emp;
};
