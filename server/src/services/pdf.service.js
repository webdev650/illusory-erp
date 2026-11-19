import PDFDocument from 'pdfkit';

/**
 * PDF generation service using PDFKit (Pure Node.js, zero headless-browser overhead).
 */

const COMPANY = {
  name: 'ILLUSORY DESIGN STUDIOS PVT. LTD.',
  address: 'DLF Cybercity, Patia, Bhubaneswar, Odisha - 751024, India',
  email: 'contact@illusorydesignstudios.com',
  website: 'https://illusorydesignstudios.com',
  gstin: '21ABCDE1234F1Z5',
};

/**
 * Format integer paise into Indian Rupee display.
 */
const formatPaise = (paise) => {
  const rupees = (Number(paise) || 0) / 100;
  return `INR ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Draw standard header for all official Illusory documents.
 */
const drawHeader = (doc, title) => {
  doc
    .fillColor('#4F46E5')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(COMPANY.name, 50, 45);

  doc
    .fillColor('#64748B')
    .fontSize(8)
    .font('Helvetica')
    .text(COMPANY.address, 50, 65)
    .text(`GSTIN: ${COMPANY.gstin} | Web: ${COMPANY.website}`, 50, 77);

  doc
    .strokeColor('#E2E8F0')
    .lineWidth(1)
    .moveTo(50, 95)
    .lineTo(550, 95)
    .stroke();

  if (title) {
    doc
      .fillColor('#1E293B')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(title.toUpperCase(), 50, 110, { align: 'center' });
  }
};

/**
 * Draw standard footer with confidentiality notice.
 */
const drawFooter = (doc) => {
  const pageBottom = doc.page.height - 40;
  doc
    .strokeColor('#E2E8F0')
    .lineWidth(0.5)
    .moveTo(50, pageBottom - 10)
    .lineTo(550, pageBottom - 10)
    .stroke();

  doc
    .fillColor('#94A3B8')
    .fontSize(7)
    .font('Helvetica')
    .text(
      'This is a computer-generated document from Illusory ERP. Confidential and Proprietary.',
      50,
      pageBottom - 5,
      { align: 'center', width: 500 }
    );
};

/**
 * Generate a formal letter (Offer, Appointment, Relieving, Experience).
 */
export const generateLetterPdf = ({
  title = 'OFFICIAL LETTER',
  recipientName = '',
  recipientCode = '',
  date = new Date(),
  contentParagraphs = [],
  signatory = 'Authorized Signatory\nIllusory Design Studios Pvt. Ltd.',
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      drawHeader(doc, title);

      let y = 145;
      const formattedDate = new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      doc.fillColor('#334155').fontSize(10).font('Helvetica');
      doc.text(`Date: ${formattedDate}`, 50, y);
      y += 20;

      if (recipientName) {
        doc.font('Helvetica-Bold').text(`To: ${recipientName}`, 50, y);
        y += 14;
      }
      if (recipientCode) {
        doc.font('Helvetica').text(`Employee/Ref Code: ${recipientCode}`, 50, y);
        y += 20;
      }

      y += 10;
      doc.font('Helvetica').fontSize(10).fillColor('#1E293B');

      contentParagraphs.forEach((para) => {
        doc.text(para, 50, y, { align: 'justify', width: 500, lineGap: 4 });
        y = doc.y + 14;
      });

      y = Math.max(y + 30, doc.page.height - 160);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1E293B').text('Sincerely,', 50, y);
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text(signatory, 50, y + 16, { lineGap: 3 });

      drawFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate an official PDF invoice.
 */
export const generateInvoicePdf = ({
  invoiceNumber = 'INV-0001',
  date = new Date(),
  dueDate = new Date(),
  client = {},
  items = [],
  subtotalPaise = 0,
  taxPaise = 0,
  totalPaise = 0,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      drawHeader(doc, 'TAX INVOICE');

      let y = 140;

      // Invoice info left / right
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1E293B').text(`Invoice #: ${invoiceNumber}`, 50, y);
      doc.font('Helvetica').text(`Invoice Date: ${new Date(date).toLocaleDateString('en-IN')}`, 50, y + 14);
      doc.text(`Due Date: ${new Date(dueDate).toLocaleDateString('en-IN')}`, 50, y + 28);

      doc.font('Helvetica-Bold').text('Billed To:', 340, y);
      doc.font('Helvetica').text(client.name || 'Client Name', 340, y + 14);
      if (client.company) doc.text(client.company, 340, y + 26);
      if (client.gstin) doc.text(`GSTIN: ${client.gstin}`, 340, y + 38);

      y = 200;

      // Table Header
      doc.rect(50, y, 500, 22).fill('#4F46E5');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
      doc.text('Description', 60, y + 6, { width: 220 });
      doc.text('Qty', 290, y + 6, { width: 40, align: 'center' });
      doc.text('Rate', 340, y + 6, { width: 70, align: 'right' });
      doc.text('Amount', 420, y + 6, { width: 120, align: 'right' });

      y += 24;
      doc.font('Helvetica').fontSize(9).fillColor('#334155');

      items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
        doc.rect(50, y, 500, 20).fill(rowBg);
        doc.fillColor('#1E293B');
        doc.text(item.description || `Item ${idx + 1}`, 60, y + 5, { width: 220 });
        doc.text(String(item.qty || 1), 290, y + 5, { width: 40, align: 'center' });
        doc.text(formatPaise(item.ratePaise), 340, y + 5, { width: 70, align: 'right' });
        doc.text(formatPaise((item.qty || 1) * (item.ratePaise || 0)), 420, y + 5, { width: 120, align: 'right' });
        y += 20;
      });

      // Totals Box
      y += 10;
      doc.rect(320, y, 230, 60).fill('#F1F5F9');
      doc.fillColor('#334155').font('Helvetica').fontSize(9);
      doc.text('Subtotal:', 330, y + 8);
      doc.text(formatPaise(subtotalPaise), 420, y + 8, { align: 'right', width: 120 });

      doc.text('Taxes (GST):', 330, y + 24);
      doc.text(formatPaise(taxPaise), 420, y + 24, { align: 'right', width: 120 });

      doc.font('Helvetica-Bold').fillColor('#4F46E5');
      doc.text('Total Payable:', 330, y + 42);
      doc.text(formatPaise(totalPaise), 420, y + 42, { align: 'right', width: 120 });

      drawFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate a confidential employee payslip PDF.
 */
export const generatePayslipPdf = ({
  employee = {},
  monthYear = 'January 2026',
  earnings = [],
  deductions = [],
  grossPaise = 0,
  netPaise = 0,
  paidDays = 30,
  lopDays = 0,
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      drawHeader(doc, `PAYSLIP FOR ${monthYear.toUpperCase()}`);

      let y = 140;

      // Employee summary
      doc.rect(50, y, 500, 50).fill('#F8FAFC');
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(9);
      doc.text('Employee Name:', 60, y + 8);
      doc.font('Helvetica').text(employee.name || '-', 160, y + 8);

      doc.font('Helvetica-Bold').text('Employee ID:', 340, y + 8);
      doc.font('Helvetica').text(employee.employeeId || '-', 430, y + 8);

      doc.font('Helvetica-Bold').text('Designation:', 60, y + 28);
      doc.font('Helvetica').text(employee.designation || '-', 160, y + 28);

      doc.font('Helvetica-Bold').text('Paid / LOP Days:', 340, y + 28);
      doc.font('Helvetica').text(`${paidDays} / ${lopDays}`, 430, y + 28);

      y += 65;

      // Earnings Table (Left) & Deductions Table (Right)
      doc.rect(50, y, 245, 20).fill('#4F46E5');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text('EARNINGS', 60, y + 5);

      doc.rect(305, y, 245, 20).fill('#DC2626');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text('DEDUCTIONS', 315, y + 5);

      y += 24;
      doc.font('Helvetica').fontSize(8).fillColor('#1E293B');

      const maxRows = Math.max(earnings.length, deductions.length, 1);
      for (let i = 0; i < maxRows; i++) {
        const earn = earnings[i];
        const ded = deductions[i];

        if (earn) {
          doc.text(earn.name, 60, y);
          doc.text(formatPaise(earn.amountPaise), 180, y, { align: 'right', width: 105 });
        }
        if (ded) {
          doc.text(ded.name, 315, y);
          doc.text(formatPaise(ded.amountPaise), 435, y, { align: 'right', width: 105 });
        }
        y += 18;
      }

      // Net Pay Box
      y += 15;
      doc.rect(50, y, 500, 35).fill('#EEF2FF');
      doc.fillColor('#4F46E5').font('Helvetica-Bold').fontSize(11);
      doc.text(`GROSS EARNINGS: ${formatPaise(grossPaise)}`, 60, y + 10);
      doc.text(`NET PAYABLE: ${formatPaise(netPaise)}`, 320, y + 10);

      drawFooter(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export default {
  generateLetterPdf,
  generateInvoicePdf,
  generatePayslipPdf,
};
