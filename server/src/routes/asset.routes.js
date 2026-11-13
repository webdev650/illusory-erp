import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import { upload } from '../middleware/upload.js';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listAssets,
  getAssetSummary,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetQr,
  exportAssets,
  getTemplate,
  importAssets,
  assignAsset,
  returnAsset,
  acknowledgeAssignment,
  getMyAssets,
  createAssetRequest,
  listAssetRequests,
  listToFulfilRequests,
  fulfilAssetRequest,
  listMaintenance,
  createMaintenance,
  reportIssueOnMyAsset,
  updateMaintenance,
  listLicenses,
  getLicenseSummary,
  createLicense,
  updateLicense,
  deleteLicense,
  revealLicenseKey,
  assignLicenseSeat,
  revokeLicenseSeat,
  getExitClearance,
  resolveClearanceItem,
  completeExitClearance,
} from '../controllers/asset.controller.js';

const router = Router();

router.use(requireAuth);

// 1. Categories
router.get(
  '/categories',
  requirePermission(['asset.read', 'asset.readOwn', 'asset.request']),
  listCategories
);
router.post('/categories', requirePermission('asset.create'), createCategory);
router.put('/categories/:id', requirePermission('asset.update'), updateCategory);
router.delete('/categories/:id', requirePermission('asset.delete'), deleteCategory);

// 2. Summary, Template, Export & Bulk Import (Placed before :id routes)
router.get('/summary', requirePermission('asset.read'), getAssetSummary);
router.get('/template', requirePermission('asset.create'), getTemplate);
router.get('/export', requirePermission('asset.export'), exportAssets);
router.post('/import', requirePermission('asset.create'), upload.single('file'), importAssets);

// 3. My Assets & Requests
router.get('/my', requirePermission('asset.readOwn'), getMyAssets);
router.post(
  '/assignments/:id/acknowledge',
  requirePermission('asset.readOwn'),
  acknowledgeAssignment
);

router.get(
  '/requests',
  requirePermission(['asset.request', 'asset.read', 'asset.approveRequest']),
  listAssetRequests
);
router.post('/requests', requirePermission('asset.request'), createAssetRequest);
router.get(
  '/requests/to-fulfil',
  requirePermission(['asset.assign', 'asset.approveRequest']),
  listToFulfilRequests
);
router.post('/requests/:id/fulfil', requirePermission('asset.assign'), fulfilAssetRequest);

// 4. Maintenance Records
router.get('/maintenance', requirePermission(['asset.maintain', 'asset.read']), listMaintenance);
router.post('/maintenance', requirePermission('asset.maintain'), createMaintenance);
router.post('/:id/report-issue', requirePermission('asset.readOwn'), reportIssueOnMyAsset);
router.put('/maintenance/:id', requirePermission('asset.maintain'), updateMaintenance);

// 5. Software Licenses
router.get('/licenses', requirePermission('license.read'), listLicenses);
router.get('/licenses/summary', requirePermission('license.read'), getLicenseSummary);
router.post('/licenses', requirePermission('license.manage'), createLicense);
router.put('/licenses/:id', requirePermission('license.manage'), updateLicense);
router.delete('/licenses/:id', requirePermission('license.manage'), deleteLicense);
router.post('/licenses/:id/reveal-key', requirePermission('asset.viewSecrets'), revealLicenseKey);
router.post('/licenses/:id/assign', requirePermission('license.manage'), assignLicenseSeat);
router.delete('/licenses/:id/assign/:empId', requirePermission('license.manage'), revokeLicenseSeat);

// 6. Exit Clearance
router.get(
  '/clearance/:employeeId',
  requirePermission(['asset.read', 'employee.read']),
  getExitClearance
);
router.post(
  '/clearance/:employeeId/items/:itemId',
  requirePermission(['asset.return', 'asset.assign']),
  resolveClearanceItem
);
router.post(
  '/clearance/:employeeId/complete',
  requirePermission(['asset.return', 'employee.status']),
  completeExitClearance
);

// 7. General Asset Registry Operations
router.get('/', requirePermission('asset.read'), listAssets);
router.post('/', requirePermission('asset.create'), createAsset);
router.get('/:id', requirePermission(['asset.read', 'asset.readOwn']), getAssetById);
router.put('/:id', requirePermission('asset.update'), updateAsset);
router.delete('/:id', requirePermission('asset.delete'), deleteAsset);
router.get('/:id/qr', requirePermission(['asset.read', 'asset.readOwn']), getAssetQr);

// 8. Asset Assign & Return
router.post('/:id/assign', requirePermission('asset.assign'), assignAsset);
router.post('/:id/return', requirePermission('asset.return'), returnAsset);

export default router;
