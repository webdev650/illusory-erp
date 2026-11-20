import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  previewEmployeeImport,
  commitEmployeeImport,
} from '../services/employeeImport.service.js';
import { generateSampleTemplate } from '../services/sampleTemplate.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Download sample Excel import template with all headers and example row
 */
export const downloadSampleTemplate = async (req, res, next) => {
  try {
    const buffer = await generateSampleTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Illusory-Employee-Import-Template.xlsx"'
    );
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * Preview / Dry-run uploaded Excel file without saving
 */
export const previewUpload = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, 'Please upload an Excel (.xlsx) file.', 400);
    }

    const preview = await previewEmployeeImport(req.file.buffer);

    return sendSuccess(res, preview, 'Excel preview generated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Commit uploaded Excel file to MongoDB
 */
export const commitUpload = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return sendError(res, 'Please upload an Excel (.xlsx) file.', 400);
    }

    const overwrite = req.body.overwrite === 'true' || req.body.overwrite === true;

    const result = await commitEmployeeImport(req.file.buffer, {
      overwrite,
      actorUser: req.user,
    });

    return sendSuccess(res, result, 'Employees imported successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Download the generated CSV credentials report
 */
export const downloadReport = async (req, res, next) => {
  try {
    const { filename } = req.params;
    // Prevent directory traversal
    const safeFilename = path.basename(filename);
    const reportPath = path.resolve(__dirname, '../../data/imports', safeFilename);

    if (!fs.existsSync(reportPath)) {
      return sendError(res, 'Report file not found or expired', 404);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    const fileStream = fs.createReadStream(reportPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export default {
  downloadSampleTemplate,
  previewUpload,
  commitUpload,
  downloadReport,
};
