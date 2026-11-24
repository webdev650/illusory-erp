import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

/**
 * Generate official PDF letter document with letterhead, signature stamp, and QR verification
 */
export const generateLetterPdfBuffer = async ({
  title,
  refNo,
  date,
  renderedBody,
  signatory,
  verificationUrl,
  isSample = false,
}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // 1. Company Letterhead Header
      doc
        .fillColor('#4F46E5')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('ILLUSORY DESIGN STUDIOS PVT. LTD.', 50, 45);

      doc
        .fillColor('#64748B')
        .fontSize(8)
        .font('Helvetica')
        .text('DLF Cybercity, Patia, Bhubaneswar, Odisha - 751024, India', 50, 65)
        .text('CIN: U72900OR2024PTC045123 | Web: https://illusorydesignstudios.com', 50, 77);

      doc
        .strokeColor('#E2E8F0')
        .lineWidth(1)
        .moveTo(50, 95)
        .lineTo(550, 95)
        .stroke();

      // 2. Reference Number & Date Bar
      doc
        .fillColor('#475569')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(`Ref: ${refNo}`, 50, 108);

      doc
        .fillColor('#475569')
        .fontSize(9)
        .font('Helvetica')
        .text(`Date: ${date ? new Date(date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`, 450, 108, { align: 'right' });

      // 3. Document Title
      doc
        .fillColor('#0F172A')
        .fontSize(13)
        .font('Helvetica-Bold')
        .text(title.toUpperCase(), 50, 135, { align: 'center', underline: true });

      // 4. Render Body Text (stripping HTML tags for clean PDFKit display)
      const cleanBodyText = renderedBody
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'");

      doc
        .fillColor('#1E293B')
        .fontSize(10)
        .font('Helvetica')
        .text(cleanBodyText, 50, 165, {
          width: 500,
          align: 'justify',
          lineGap: 4,
        });

      // 5. Signatory Block & QR Code
      const yPosition = Math.max(doc.y + 25, 640);

      doc
        .fillColor('#0F172A')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('For ILLUSORY DESIGN STUDIOS PVT. LTD.', 50, yPosition);

      doc
        .fillColor('#334155')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(signatory?.name || 'Aparna Tripathy', 50, yPosition + 40);

      doc
        .fillColor('#64748B')
        .fontSize(9)
        .font('Helvetica')
        .text(signatory?.designation || 'Managing Director', 50, yPosition + 54);

      // Generate QR Code if verification URL provided
      if (verificationUrl) {
        try {
          const qrDataUrl = await QRCode.toDataURL(verificationUrl, { width: 70, margin: 1 });
          const qrImageBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
          doc.image(qrImageBuffer, 480, yPosition + 10, { width: 65 });
          doc
            .fillColor('#94A3B8')
            .fontSize(6)
            .font('Helvetica')
            .text('Scan to Verify Authenticity', 460, yPosition + 80, { width: 100, align: 'center' });
        } catch (qrErr) {
          console.warn('QR Code generation failed:', qrErr.message);
        }
      }

      // 6. Sample Watermark / Notice
      if (isSample) {
        doc
          .fillColor('#EF4444')
          .fontSize(8)
          .font('Helvetica-Bold')
          .text(
            'SAMPLE DOCUMENT - HAVE YOUR LAWYER REVIEW BEFORE USE',
            50,
            doc.page.height - 35,
            { align: 'center', width: 500 }
          );
      } else {
        doc
          .fillColor('#94A3B8')
          .fontSize(7)
          .font('Helvetica')
          .text(
            'This is a digitally generated document issued by Illusory ERP. Verification token encoded.',
            50,
            doc.page.height - 30,
            { align: 'center', width: 500 }
          );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
