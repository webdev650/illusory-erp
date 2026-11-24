/**
 * Calculates profile completeness percentage and returns checklist of missing fields
 */
export const calculateProfileCompleteness = (employee) => {
  if (!employee) return { percentage: 0, missingFields: [] };

  const checks = [
    { name: 'Profile Photo', check: Boolean(employee.personal?.photo?.url) },
    { name: 'Phone Number', check: Boolean(employee.personal?.phone) },
    { name: 'Personal Email', check: Boolean(employee.personal?.personalEmail) },
    { name: 'Date of Birth', check: Boolean(employee.personal?.dob) },
    { name: 'Blood Group', check: Boolean(employee.personal?.bloodGroup && employee.personal.bloodGroup !== 'Unknown') },
    { name: 'Current Address', check: Boolean(employee.personal?.currentAddress?.addressLine1 && employee.personal?.currentAddress?.city) },
    { name: 'Permanent Address', check: Boolean(employee.personal?.permanentAddress?.addressLine1 && employee.personal?.permanentAddress?.city) },
    { name: 'Emergency Contact', check: Boolean(employee.emergencyContacts && employee.emergencyContacts.length > 0) },
    { name: 'Reporting Manager', check: Boolean(employee.employment?.reportingManager) },
    { name: 'Assigned Shift', check: Boolean(employee.employment?.shift) },
    { name: 'Aadhaar / ID', check: Boolean(employee.statutory?.aadhaar) },
    { name: 'PAN Number', check: Boolean(employee.statutory?.pan) },
    { name: 'Bank Account', check: Boolean(employee.bank?.accountNumber && employee.bank?.ifsc) },
    { name: 'Education Record', check: Boolean(employee.education && employee.education.length > 0) },
    { name: 'Required Documents', check: Boolean(employee.documents && employee.documents.length >= 2) },
  ];

  const completed = checks.filter((c) => c.check).length;
  const missing = checks.filter((c) => !c.check).map((c) => c.name);
  const percentage = Math.round((completed / checks.length) * 100);

  return {
    percentage,
    completedCount: completed,
    totalCount: checks.length,
    missingFields: missing,
  };
};
