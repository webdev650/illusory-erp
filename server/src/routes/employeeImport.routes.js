import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  downloadSampleTemplate,
  previewUpload,
  commitUpload,
  downloadReport,
} from '../controllers/employeeImport.controller.js';

const router = Router();

// In-memory multer storage with 5MB limit and .xlsx MIME / extension validation
const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const isXlsx =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.originalname.match(/\.xlsx$/i);

    if (isXlsx) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx) files are allowed.'));
    }
  },
});

/**
 * @route   GET /api/v1/employees/import/template
 * @desc    Download sample Excel template
 * @access  Private (employee.import)
 */
router.get(
  '/template',
  requireAuth,
  requirePermission('employee.import'),
  downloadSampleTemplate
);

/**
 * @route   POST /api/v1/employees/import/preview
 * @desc    Dry-run / Preview uploaded Excel spreadsheet
 * @access  Private (employee.import)
 */
router.post(
  '/preview',
  requireAuth,
  requirePermission('employee.import'),
  uploadXlsx.single('file'),
  previewUpload
);

/**
 * @route   POST /api/v1/employees/import/commit
 * @desc    Commit uploaded Excel spreadsheet to database
 * @access  Private (employee.import)
 */
router.post(
  '/commit',
  requireAuth,
  requirePermission('employee.import'),
  uploadXlsx.single('file'),
  commitUpload
);

/**
 * @route   GET /api/v1/employees/import/report/:filename
 * @desc    Download generated credentials report
 * @access  Private (employee.import)
 */
router.get(
  '/report/:filename',
  requireAuth,
  requirePermission('employee.import'),
  downloadReport
);

export default router;
