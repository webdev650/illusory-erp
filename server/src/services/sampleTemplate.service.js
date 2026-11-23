import ExcelJS from 'exceljs';

export const SAMPLE_TEMPLATE_HEADERS = [
  'SL NO.',
  'Type (Employee/Intern)',
  'Custom Employee Code',
  'Joining Date',
  'First Name',
  'Middle Name',
  'Last Name',
  'Display Name',
  'Gender',
  'Nationality',
  'Contact',
  'Home Phone',
  'Work Phone',
  'Personal Email ID',
  'Work Email ID',
  'Bio Metric ID',
  'Department',
  'Designation',
  'User Role',
  'Report To',
  'Employment Type',
  'Date Of Birth',
  'Blood Group',
  'Marrital Status',
  "Father's Name",
  "Mother's Name",
  'Spouse Name',
  'Spouse Contact No',
  'Date of Anniversary',
  'Emergency contant person',
  'Emergency Contact Number',
  'Relation With',
  'Current Address',
  'Country',
  'State',
  'District',
  'City',
  'Area',
  'Pincode',
  'Permanent Address',
  'Highest Education',
  'Work Exeperience',
  'Last Company',
  'Payroll Type',
  'Salary Account',
  'UAN Number',
  'EPF Number',
  'Bank Name',
  'Bank Branch',
  'Account Type',
  'Account Holder Name',
  'Account Number',
  'IFSC code',
  'Aadhaar Number',
  'Pan Number',
  'Notice Period',
  'Clock In',
  'Clock Out',
  'Break In',
  'Break Out',
  'Password',
];

export const generateSampleTemplate = async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Illusory ERP';
  workbook.created = new Date();

  const sheets = [
    { name: 'Employee', role: 'Employee' },
    { name: 'Admin', role: 'Admin (HR Manager)' },
    { name: 'Super Admin', role: 'Super Admin (Full Studio Access)' },
  ];

  sheets.forEach(({ name }) => {
    const ws = workbook.addWorksheet(name);

    // Style header
    const headerRow = ws.addRow(SAMPLE_TEMPLATE_HEADERS);
    headerRow.height = 26;
    headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Brand indigo
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Auto-width
    ws.columns = SAMPLE_TEMPLATE_HEADERS.map((h) => ({
      key: h,
      width: Math.max(h.length + 4, 15),
    }));

    // Example Row
    const sampleRow = ws.addRow([
      '1',
      'EMPLOYEE',
      'IDS-E26-EX001',
      '2026-01-15',
      'Sample',
      '-',
      'User',
      'Sample User',
      'Male',
      'Indian',
      '9876543210',
      '-',
      '9876543210',
      'sample.personal@example.com',
      'sample.user@illusorydesignstudios.com',
      'BIO-001',
      'Designing',
      'Creative Designer',
      'Creative Designer',
      'Aparna Tripathy',
      'FULL TIME',
      '2001-05-20',
      'B+',
      'single',
      'Sample Father',
      'Sample Mother',
      'NA',
      'NA',
      'NA',
      'Sample Mother',
      '9876543210',
      'Mother',
      'Flat 101, Niladri Vihar, Bhubaneswar',
      'India',
      'Odisha',
      'Khordha',
      'Bhubaneswar',
      'Niladri Vihar',
      '751021',
      'At/Po - Jajpur, Odisha - 755001',
      'B.Tech',
      '2 Years',
      'ABC Tech Pvt Ltd',
      'MONTHLY FIXED',
      'SBI',
      '100123456789',
      'OR/BBS/12345/678',
      'State Bank of India',
      'Bhubaneswar Main',
      'Savings Account',
      'Sample User',
      '123456789012',
      'SBIN0001234',
      '123456789012',
      'ABCDE1234F',
      '30 days',
      '10:00',
      '18:45',
      '13:00',
      '14:00',
      '',
    ]);

    sampleRow.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
    sampleRow.height = 20;
  });

  return await workbook.xlsx.writeBuffer();
};

export default {
  SAMPLE_TEMPLATE_HEADERS,
  generateSampleTemplate,
};
