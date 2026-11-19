import ExcelJS from 'exceljs';

/**
 * Standard Excel and CSV export generator using ExcelJS.
 */

/**
 * Generate an Excel workbook buffer from tabular data.
 * @param {object} options
 * @param {string} [options.title] - Optional title banner at top
 * @param {Array<{ header: string, key: string, width?: number }>} options.columns
 * @param {Array<object>} options.data
 * @param {string} [options.sheetName='Export']
 * @returns {Promise<Buffer>}
 */
export const exportToExcel = async ({
  title = '',
  columns = [],
  data = [],
  sheetName = 'Data',
}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Illusory ERP';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: title ? 2 : 1 }],
  });

  let startRow = 1;

  if (title) {
    const titleRow = worksheet.addRow([title]);
    titleRow.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Brand indigo
    };
    worksheet.mergeCells(1, 1, 1, Math.max(columns.length, 1));
    titleRow.height = 28;
    titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
    startRow = 2;
  }

  // Set columns & header formatting
  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || Math.max(col.header.length + 5, 14),
  }));

  const headerRow = worksheet.getRow(startRow);
  headerRow.height = 24;
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF312E81' }, // Dark indigo header
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

  // Add rows
  data.forEach((item) => {
    worksheet.addRow(item);
  });

  // Style data rows with subtle borders
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > startRow) {
      row.height = 20;
      row.alignment = { vertical: 'middle' };
      row.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (rowNumber % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' }, // Light slate zebra stripe
        };
      }
    }
  });

  return await workbook.xlsx.writeBuffer();
};

/**
 * Generate a CSV buffer from tabular data.
 * @param {object} options
 * @param {Array<{ header: string, key: string }>} options.columns
 * @param {Array<object>} options.data
 * @returns {Promise<Buffer>}
 */
export const exportToCsv = async ({ columns = [], data = [] }) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('CSV');

  worksheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
  }));

  data.forEach((item) => {
    worksheet.addRow(item);
  });

  return await workbook.csv.writeBuffer();
};

/**
 * Stream an Excel file directly to an Express HTTP response.
 */
export const streamExcelToResponse = async (res, { filename = 'export.xlsx', title, columns, data }) => {
  const buffer = await exportToExcel({ title, columns, data });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
};

/**
 * Stream a CSV file directly to an Express HTTP response.
 */
export const streamCsvToResponse = async (res, { filename = 'export.csv', columns, data }) => {
  const buffer = await exportToCsv({ columns, data });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
};

export default {
  exportToExcel,
  exportToCsv,
  streamExcelToResponse,
  streamCsvToResponse,
};
