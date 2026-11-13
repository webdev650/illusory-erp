import { z } from 'zod';
import Asset from '../models/Asset.js';
import AssetCategory from '../models/AssetCategory.js';
import AssetAssignment from '../models/AssetAssignment.js';
import AssetRequest from '../models/AssetRequest.js';
import MaintenanceRecord from '../models/MaintenanceRecord.js';
import SoftwareLicense from '../models/SoftwareLicense.js';
import ExitClearance from '../models/ExitClearance.js';
import Employee from '../models/Employee.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import {
  encryptLicenseKey,
  decryptLicenseKey,
  generateNextAssetTag,
  generateAssetQrCode,
  initiateExitClearance,
  getAssetCsvTemplate,
  importAssetsFromCsv,
} from '../services/asset.service.js';
import { notifyEmployee } from '../services/notification.service.js';

// ==========================================
// 1. ASSET CATEGORIES CRUD
// ==========================================

export const listCategories = async (req, res, next) => {
  try {
    const categories = await AssetCategory.find({ isActive: true }).sort({ name: 1 });
    return sendSuccess(res, categories, 'Categories retrieved');
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, code, type, depreciationYears, customFields } = req.body;
    if (!name || !code) {
      return sendError(res, 'Name and code are required', 400);
    }

    const category = await AssetCategory.create({
      name,
      code: code.toUpperCase(),
      type: type || 'hardware',
      depreciationYears: depreciationYears || null,
      customFields: customFields || [],
    });

    await logAudit({
      req,
      action: 'CREATE_ASSET_CATEGORY',
      entity: 'AssetCategory',
      entityId: category._id,
      changes: req.body,
    });

    return sendSuccess(res, category, 'Category created', 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await AssetCategory.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!category) return sendError(res, 'Category not found', 404);

    await logAudit({
      req,
      action: 'UPDATE_ASSET_CATEGORY',
      entity: 'AssetCategory',
      entityId: category._id,
      changes: req.body,
    });

    return sendSuccess(res, category, 'Category updated');
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const count = await Asset.countDocuments({ category: req.params.id, isDeleted: false });
    if (count > 0) {
      return sendError(res, `Cannot delete category: ${count} active assets are linked to it.`, 400);
    }

    await AssetCategory.findByIdAndUpdate(req.params.id, { isActive: false });
    return sendSuccess(res, null, 'Category archived');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. ASSETS CRUD & INVENTORY
// ==========================================

export const listAssets = async (req, res, next) => {
  try {
    const {
      status,
      category,
      currentAssignee,
      search,
      warrantyExpiring,
      page = 1,
      limit = 50,
    } = req.query;

    const query = { isDeleted: false };

    if (status) query.status = status;
    if (category) query.category = category;
    if (currentAssignee) query.currentAssignee = currentAssignee;

    if (search) {
      const reg = new RegExp(search.trim(), 'i');
      query.$or = [
        { assetTag: reg },
        { name: reg },
        { brand: reg },
        { model: reg },
        { serialNumber: reg },
      ];
    }

    if (warrantyExpiring === 'true') {
      const now = new Date();
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      query.warrantyExpiry = { $gte: now, $lte: in30Days };
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [total, rawAssets] = await Promise.all([
      Asset.countDocuments(query),
      Asset.find(query)
        .populate('category', 'name code type')
        .populate('currentAssignee', 'personal.firstName personal.lastName employeeId personal.photo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    // Mask purchaseCost if user lacks asset.viewCost
    const canViewCost =
      req.permissions?.includes('*') ||
      req.permissions?.includes('asset.viewCost') ||
      ['super_admin', 'admin', 'it_admin'].includes(req.userRole);

    const assets = rawAssets.map((ast) => {
      if (!canViewCost) {
        delete ast.purchaseCost;
      }
      return ast;
    });

    return sendSuccess(res, {
      assets,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getAssetSummary = async (req, res, next) => {
  try {
    const canViewCost =
      req.permissions?.includes('*') ||
      req.permissions?.includes('asset.viewCost') ||
      ['super_admin', 'admin', 'it_admin'].includes(req.userRole);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      available,
      assigned,
      underRepair,
      lost,
      retired,
      expiringWarranties,
      expiringLicenses,
      categoryCounts,
      costAgg,
    ] = await Promise.all([
      Asset.countDocuments({ isDeleted: false }),
      Asset.countDocuments({ status: 'available', isDeleted: false }),
      Asset.countDocuments({ status: 'assigned', isDeleted: false }),
      Asset.countDocuments({ status: 'under_repair', isDeleted: false }),
      Asset.countDocuments({ status: 'lost', isDeleted: false }),
      Asset.countDocuments({ status: 'retired', isDeleted: false }),
      Asset.countDocuments({
        warrantyExpiry: { $gte: now, $lte: in30Days },
        isDeleted: false,
      }),
      SoftwareLicense.countDocuments({
        renewalDate: { $gte: now, $lte: in30Days },
        status: { $ne: 'cancelled' },
      }),
      Asset.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'assetcategories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo',
          },
        },
        { $unwind: '$categoryInfo' },
        {
          $project: {
            categoryId: '$_id',
            categoryName: '$categoryInfo.name',
            categoryCode: '$categoryInfo.code',
            count: 1,
          },
        },
      ]),
      Asset.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: null, totalCostPaise: { $sum: '$purchaseCost' } } },
      ]),
    ]);

    const totalCostPaise = costAgg[0]?.totalCostPaise || 0;

    return sendSuccess(res, {
      total,
      available,
      assigned,
      underRepair,
      lost,
      retired,
      expiringWarranties,
      expiringLicenses,
      categoryCounts,
      totalCostPaise: canViewCost ? totalCostPaise : null,
    });
  } catch (err) {
    next(err);
  }
};

export const getAssetById = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false })
      .populate('category')
      .populate('currentAssignee', 'personal.firstName personal.lastName employeeId personal.photo employment.designation')
      .lean();

    if (!asset) return sendError(res, 'Asset not found', 404);

    // Check cost permission
    const canViewCost =
      req.permissions?.includes('*') ||
      req.permissions?.includes('asset.viewCost') ||
      ['super_admin', 'admin', 'it_admin'].includes(req.userRole);

    if (!canViewCost) {
      delete asset.purchaseCost;
    }

    // Load full assignment timeline
    const assignments = await AssetAssignment.find({ asset: asset._id })
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('assignedBy', 'email')
      .populate('receivedBy', 'email')
      .sort({ createdAt: -1 })
      .lean();

    // Load maintenance history
    const maintenance = await MaintenanceRecord.find({ asset: asset._id })
      .populate('reportedBy', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 })
      .lean();

    if (!canViewCost) {
      maintenance.forEach((m) => {
        delete m.cost;
      });
    }

    return sendSuccess(res, {
      asset,
      assignments,
      maintenance,
    });
  } catch (err) {
    next(err);
  }
};

export const createAsset = async (req, res, next) => {
  try {
    const data = { ...req.body };

    if (!data.name || !data.category) {
      return sendError(res, 'Asset name and category are required', 400);
    }

    // Check serial uniqueness if provided
    if (data.serialNumber) {
      const exists = await Asset.findOne({ serialNumber: data.serialNumber, isDeleted: false });
      if (exists) {
        return sendError(res, `Serial number "${data.serialNumber}" already registered for asset ${exists.assetTag}.`, 400);
      }
    }

    if (!data.assetTag) {
      data.assetTag = await generateNextAssetTag();
    }
    data.qrCodeValue = data.assetTag;

    const asset = await Asset.create(data);

    await logAudit({
      req,
      action: 'CREATE_ASSET',
      entity: 'Asset',
      entityId: asset._id,
      changes: { assetTag: asset.assetTag, name: asset.name },
    });

    return sendSuccess(res, asset, 'Asset registered successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const current = await Asset.findOne({ _id: id, isDeleted: false });
    if (!current) return sendError(res, 'Asset not found', 404);

    if (req.body.serialNumber && req.body.serialNumber !== current.serialNumber) {
      const exists = await Asset.findOne({
        serialNumber: req.body.serialNumber,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (exists) {
        return sendError(res, `Serial number "${req.body.serialNumber}" already in use.`, 400);
      }
    }

    const updated = await Asset.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate('category');

    await logAudit({
      req,
      action: 'UPDATE_ASSET',
      entity: 'Asset',
      entityId: id,
      changes: req.body,
    });

    return sendSuccess(res, updated, 'Asset updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return sendError(res, 'Asset not found', 404);

    if (asset.status === 'assigned') {
      return sendError(res, 'Cannot delete an assigned asset. Return it first.', 400);
    }

    asset.isDeleted = true;
    asset.status = 'retired';
    await asset.save();

    await logAudit({
      req,
      action: 'DELETE_ASSET',
      entity: 'Asset',
      entityId: asset._id,
      changes: { assetTag: asset.assetTag },
    });

    return sendSuccess(res, null, 'Asset deleted successfully');
  } catch (err) {
    next(err);
  }
};

export const getAssetQr = async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return sendError(res, 'Asset not found', 404);

    const { mime, buffer } = await generateAssetQrCode(asset.assetTag);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `inline; filename="${asset.assetTag}-qr.${mime.includes('png') ? 'png' : 'svg'}"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};

export const exportAssets = async (req, res, next) => {
  try {
    const canViewCost =
      req.permissions?.includes('*') ||
      req.permissions?.includes('asset.viewCost') ||
      ['super_admin', 'admin', 'it_admin'].includes(req.userRole);

    const assets = await Asset.find({ isDeleted: false })
      .populate('category', 'name code')
      .populate('currentAssignee', 'personal.firstName personal.lastName employeeId')
      .sort({ assetTag: 1 });

    const header = [
      'Asset Tag',
      'Name',
      'Category',
      'Brand',
      'Model',
      'Serial Number',
      'Status',
      'Condition',
      'Current Assignee',
      'Assignee ID',
      'Location',
      'Warranty Expiry',
      ...(canViewCost ? ['Purchase Cost (INR)'] : []),
    ];

    const rows = assets.map((a) => [
      `"${a.assetTag}"`,
      `"${a.name}"`,
      `"${a.category?.name || ''}"`,
      `"${a.brand || ''}"`,
      `"${a.model || ''}"`,
      `"${a.serialNumber || ''}"`,
      `"${a.status}"`,
      `"${a.condition}"`,
      `"${a.currentAssignee ? `${a.currentAssignee.personal?.firstName} ${a.currentAssignee.personal?.lastName}` : ''}"`,
      `"${a.currentAssignee?.employeeId || ''}"`,
      `"${a.location || ''}"`,
      `"${a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString('en-IN') : ''}"`,
      ...(canViewCost ? [(a.purchaseCost / 100).toFixed(2)] : []),
    ]);

    const csvData = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="illusory_assets_register.csv"');
    return res.send(csvData);
  } catch (err) {
    next(err);
  }
};

export const getTemplate = async (req, res) => {
  const template = getAssetCsvTemplate();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="asset_import_template.csv"');
  return res.send(template);
};

export const importAssets = async (req, res, next) => {
  try {
    let csvData = req.body.csv;
    if (!csvData && req.file) {
      csvData = req.file.buffer.toString('utf-8');
    }

    if (!csvData) {
      return sendError(res, 'CSV content or file is required', 400);
    }

    const result = await importAssetsFromCsv(csvData, req.user._id);

    await logAudit({
      req,
      action: 'BULK_IMPORT_ASSETS',
      entity: 'Asset',
      changes: {
        successfulCount: result.successful.length,
        errorsCount: result.errors.length,
      },
    });

    return sendSuccess(res, result, 'Bulk import completed');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. ASSET ASSIGNMENTS & RETURN
// ==========================================

export const assignAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeId, expectedReturnDate, conditionAtIssue, issueNotes } = req.body;

    const asset = await Asset.findOne({ _id: id, isDeleted: false });
    if (!asset) return sendError(res, 'Asset not found', 404);

    if (asset.status !== 'available') {
      return sendError(
        res,
        `Cannot assign asset: Asset is currently "${asset.status}". It must be "available" to assign.`,
        400
      );
    }

    const employee = await Employee.findOne({ _id: employeeId, isDeleted: false });
    if (!employee) return sendError(res, 'Employee not found', 404);

    const assignment = await AssetAssignment.create({
      asset: asset._id,
      employee: employee._id,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      conditionAtIssue: conditionAtIssue || asset.condition || 'good',
      issueNotes: issueNotes || '',
      status: 'active',
      acknowledgement: {
        accepted: false,
      },
    });

    asset.status = 'assigned';
    asset.currentAssignee = employee._id;
    asset.condition = conditionAtIssue || asset.condition;
    await asset.save();

    await notifyEmployee(employee._id, {
      title: 'New Asset Assigned',
      message: `${asset.name} (${asset.assetTag}) was assigned to you. Please review and acknowledge receipt in My Assets.`,
      link: '/assets?tab=my_assets',
      type: 'asset_assignment',
    });

    await logAudit({
      req,
      action: 'ASSIGN_ASSET',
      entity: 'AssetAssignment',
      entityId: assignment._id,
      changes: {
        asset: asset.assetTag,
        employee: employee.employeeId,
      },
    });

    return sendSuccess(res, { asset, assignment }, 'Asset assigned successfully');
  } catch (err) {
    next(err);
  }
};

export const returnAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { conditionAtReturn, returnNotes, markUnderRepair } = req.body;

    const asset = await Asset.findOne({ _id: id, isDeleted: false });
    if (!asset) return sendError(res, 'Asset not found', 404);

    const activeAssignment = await AssetAssignment.findOne({
      asset: asset._id,
      status: 'active',
    });

    if (!activeAssignment) {
      return sendError(res, 'No active assignment found for this asset', 400);
    }

    const previousAssigneeId = activeAssignment.employee;

    activeAssignment.status = 'returned';
    activeAssignment.returnedAt = new Date();
    activeAssignment.receivedBy = req.user._id;
    activeAssignment.conditionAtReturn = conditionAtReturn || 'good';
    activeAssignment.returnNotes = returnNotes || '';
    await activeAssignment.save();

    // Determine post-return status
    if (markUnderRepair || conditionAtReturn === 'poor') {
      asset.status = 'under_repair';
    } else {
      asset.status = 'available';
    }

    asset.condition = conditionAtReturn || asset.condition;
    asset.currentAssignee = null;
    await asset.save();

    // Check if employee is in exit clearance and mark this item returned
    const clearance = await ExitClearance.findOne({ employee: previousAssigneeId });
    if (clearance) {
      const item = clearance.checklist.find(
        (c) => c.itemType === 'asset' && c.referenceId.toString() === asset._id.toString()
      );
      if (item) {
        item.status = 'returned';
        item.conditionAtReturn = conditionAtReturn || 'good';
        item.note = returnNotes || '';
        item.resolvedAt = new Date();
        await clearance.save();
      }
    }

    await logAudit({
      req,
      action: 'RETURN_ASSET',
      entity: 'AssetAssignment',
      entityId: activeAssignment._id,
      changes: {
        asset: asset.assetTag,
        conditionAtReturn,
      },
    });

    return sendSuccess(res, { asset, assignment: activeAssignment }, 'Asset returned successfully');
  } catch (err) {
    next(err);
  }
};

export const acknowledgeAssignment = async (req, res, next) => {
  try {
    const assignment = await AssetAssignment.findById(req.params.id).populate('asset');
    if (!assignment) return sendError(res, 'Assignment not found', 404);

    const userEmpId = req.user?.employee?.toString();
    if (!userEmpId || assignment.employee.toString() !== userEmpId) {
      return sendError(res, 'You can only acknowledge assets assigned to yourself', 403);
    }

    assignment.acknowledgement = {
      accepted: true,
      acceptedAt: new Date(),
    };
    await assignment.save();

    await logAudit({
      req,
      action: 'ACKNOWLEDGE_ASSET',
      entity: 'AssetAssignment',
      entityId: assignment._id,
    });

    return sendSuccess(res, assignment, 'Asset receipt acknowledged');
  } catch (err) {
    next(err);
  }
};

export const getMyAssets = async (req, res, next) => {
  try {
    const userEmpId = req.user?.employee;
    if (!userEmpId) {
      return sendSuccess(res, { currentAssets: [], pastAssignments: [] });
    }

    // Active assigned assets
    const activeAssignments = await AssetAssignment.find({
      employee: userEmpId,
      status: 'active',
    })
      .populate({
        path: 'asset',
        populate: { path: 'category' },
      })
      .sort({ assignedAt: -1 })
      .lean();

    // Past assignments
    const pastAssignments = await AssetAssignment.find({
      employee: userEmpId,
      status: { $in: ['returned', 'lost'] },
    })
      .populate({
        path: 'asset',
        populate: { path: 'category' },
      })
      .sort({ returnedAt: -1 })
      .lean();

    // Mask purchase costs for employee self-view
    activeAssignments.forEach((a) => {
      if (a.asset) delete a.asset.purchaseCost;
    });
    pastAssignments.forEach((a) => {
      if (a.asset) delete a.asset.purchaseCost;
    });

    return sendSuccess(res, {
      currentAssets: activeAssignments,
      pastAssignments,
    });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. ASSET REQUESTS & FULFILMENT
// ==========================================

export const createAssetRequest = async (req, res, next) => {
  try {
    const { category, reason, neededBy } = req.body;
    const userEmpId = req.user?.employee;
    if (!userEmpId) return sendError(res, 'Employee profile required to request assets', 400);

    const emp = await Employee.findById(userEmpId).populate('employment.reportingManager');
    const cat = await AssetCategory.findById(category);
    if (!cat) return sendError(res, 'Asset category not found', 404);

    const request = await AssetRequest.create({
      employee: userEmpId,
      category,
      reason,
      neededBy: neededBy ? new Date(neededBy) : null,
      status: 'pending',
    });

    // 2-Step Approval Request: Step 1 = Reporting Manager (or PM/CEO), Step 2 = IT/HR
    const managerId = emp.employment?.reportingManager?._id;
    const approval = await ApprovalRequest.create({
      type: 'asset_request',
      referenceModel: 'AssetRequest',
      referenceId: request._id,
      requestedBy: userEmpId,
      title: `Asset Request: ${cat.name} (${emp.personal.firstName} ${emp.personal.lastName})`,
      metadata: {
        categoryName: cat.name,
        reason,
        neededBy,
      },
      steps: [
        {
          order: 1,
          title: 'Manager Approval',
          approverEmployee: managerId || null,
          approverRole: managerId ? undefined : 'hr',
          status: 'pending',
        },
        {
          order: 2,
          title: 'IT / HR Fulfilment Approval',
          approverRole: 'it_admin',
          status: 'pending',
        },
      ],
      currentStep: 1,
      status: 'pending',
    });

    request.approvalRequest = approval._id;
    await request.save();

    await logAudit({
      req,
      action: 'REQUEST_ASSET',
      entity: 'AssetRequest',
      entityId: request._id,
      changes: { category: cat.name, reason },
    });

    return sendSuccess(res, request, 'Asset request submitted for approval', 201);
  } catch (err) {
    next(err);
  }
};

export const listAssetRequests = async (req, res, next) => {
  try {
    const query = {};
    const hasReadAll =
      req.permissions?.includes('*') ||
      req.permissions?.includes('asset.read') ||
      ['super_admin', 'admin', 'it_admin', 'hr'].includes(req.userRole);

    if (!hasReadAll) {
      query.employee = req.user?.employee;
    }

    const requests = await AssetRequest.find(query)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('category', 'name code')
      .populate('asset', 'name assetTag')
      .populate('approvalRequest')
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'Asset requests retrieved');
  } catch (err) {
    next(err);
  }
};

export const listToFulfilRequests = async (req, res, next) => {
  try {
    const requests = await AssetRequest.find({ status: 'approved' })
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation personal.photo')
      .populate('category', 'name code')
      .sort({ createdAt: -1 });

    return sendSuccess(res, requests, 'Approved requests ready for fulfilment');
  } catch (err) {
    next(err);
  }
};

export const fulfilAssetRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assetId, conditionAtIssue, issueNotes, expectedReturnDate } = req.body;

    const request = await AssetRequest.findById(id).populate('category');
    if (!request) return sendError(res, 'Asset request not found', 404);

    if (request.status !== 'approved') {
      return sendError(res, `Cannot fulfil request with status "${request.status}". Must be "approved".`, 400);
    }

    const asset = await Asset.findOne({ _id: assetId, isDeleted: false });
    if (!asset) return sendError(res, 'Asset not found', 404);

    if (asset.status !== 'available') {
      return sendError(res, `Asset ${asset.assetTag} is not available (status: ${asset.status}).`, 400);
    }

    // Assign asset
    const assignment = await AssetAssignment.create({
      asset: asset._id,
      employee: request.employee,
      assignedBy: req.user._id,
      assignedAt: new Date(),
      expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
      conditionAtIssue: conditionAtIssue || 'good',
      issueNotes: issueNotes || `Fulfilled asset request #${request._id}`,
      status: 'active',
      acknowledgement: { accepted: false },
    });

    asset.status = 'assigned';
    asset.currentAssignee = request.employee;
    await asset.save();

    request.status = 'fulfilled';
    request.asset = asset._id;
    await request.save();

    await notifyEmployee(request.employee, {
      title: 'Asset Request Fulfilled',
      message: `Your requested device ${asset.name} (${asset.assetTag}) was assigned to you. Please acknowledge receipt in My Assets.`,
      link: '/assets?tab=my_assets',
      type: 'asset',
    });

    await logAudit({
      req,
      action: 'FULFIL_ASSET_REQUEST',
      entity: 'AssetRequest',
      entityId: request._id,
      changes: { asset: asset.assetTag },
    });

    return sendSuccess(res, { request, asset, assignment }, 'Request fulfilled successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 5. MAINTENANCE & SERVICE TICKETS
// ==========================================

export const listMaintenance = async (req, res, next) => {
  try {
    const { status, assetId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (assetId) query.asset = assetId;

    const canViewCost =
      req.permissions?.includes('*') ||
      req.permissions?.includes('asset.viewCost') ||
      ['super_admin', 'admin', 'it_admin'].includes(req.userRole);

    const records = await MaintenanceRecord.find(query)
      .populate('asset', 'name assetTag brand model status')
      .populate('reportedBy', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 })
      .lean();

    if (!canViewCost) {
      records.forEach((r) => delete r.cost);
    }

    return sendSuccess(res, records, 'Maintenance records retrieved');
  } catch (err) {
    next(err);
  }
};

export const createMaintenance = async (req, res, next) => {
  try {
    const { assetId, type, issue, vendor, cost, notes } = req.body;
    const asset = await Asset.findById(assetId);
    if (!asset) return sendError(res, 'Asset not found', 404);

    const userEmpId = req.user?.employee || asset.currentAssignee;

    const record = await MaintenanceRecord.create({
      asset: asset._id,
      type: type || 'repair',
      reportedBy: userEmpId,
      issue,
      vendor: vendor || '',
      cost: cost ? Math.round(Number(cost)) : 0,
      notes: notes || '',
      status: 'in_progress',
      startedAt: new Date(),
    });

    asset.status = 'under_repair';
    await asset.save();

    await logAudit({
      req,
      action: 'CREATE_MAINTENANCE_RECORD',
      entity: 'MaintenanceRecord',
      entityId: record._id,
      changes: { asset: asset.assetTag, issue },
    });

    return sendSuccess(res, record, 'Maintenance record created', 201);
  } catch (err) {
    next(err);
  }
};

export const reportIssueOnMyAsset = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { issue, notes } = req.body;

    const asset = await Asset.findById(id);
    if (!asset) return sendError(res, 'Asset not found', 404);

    const userEmpId = req.user?.employee?.toString();
    if (!userEmpId || asset.currentAssignee?.toString() !== userEmpId) {
      return sendError(res, 'You can only report issues on assets currently assigned to you', 403);
    }

    const record = await MaintenanceRecord.create({
      asset: asset._id,
      type: 'repair',
      reportedBy: userEmpId,
      issue,
      notes: notes || '',
      status: 'open',
      startedAt: new Date(),
    });

    // Notify IT Admins
    const itStaff = await Employee.find({
      'employment.designation': { $regex: /IT|Admin/i },
    }).limit(5);

    for (const staff of itStaff) {
      await notifyEmployee(staff._id, {
        title: `Issue Reported: ${asset.assetTag}`,
        message: `${asset.name} reported issue: "${issue}".`,
        link: '/assets?tab=maintenance',
        type: 'maintenance',
      });
    }

    await logAudit({
      req,
      action: 'REPORT_ASSET_ISSUE',
      entity: 'MaintenanceRecord',
      entityId: record._id,
      changes: { asset: asset.assetTag, issue },
    });

    return sendSuccess(res, record, 'Issue reported to IT helpdesk', 201);
  } catch (err) {
    next(err);
  }
};

export const updateMaintenance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const record = await MaintenanceRecord.findById(id).populate('asset');
    if (!record) return sendError(res, 'Maintenance record not found', 404);

    const { status, vendor, cost, notes } = req.body;

    if (vendor !== undefined) record.vendor = vendor;
    if (cost !== undefined) record.cost = Math.round(Number(cost));
    if (notes !== undefined) record.notes = notes;

    if (status) {
      record.status = status;
      if (status === 'completed') {
        record.completedAt = new Date();

        // Release asset back to available (or assigned if still has an assignee)
        if (record.asset) {
          const activeAssign = await AssetAssignment.findOne({
            asset: record.asset._id,
            status: 'active',
          });
          if (activeAssign) {
            record.asset.status = 'assigned';
            record.asset.currentAssignee = activeAssign.employee;
          } else {
            record.asset.status = 'available';
            record.asset.currentAssignee = null;
          }
          await record.asset.save();
        }
      } else if (status === 'in_progress') {
        if (record.asset) {
          record.asset.status = 'under_repair';
          await record.asset.save();
        }
      }
    }

    await record.save();

    await logAudit({
      req,
      action: 'UPDATE_MAINTENANCE_RECORD',
      entity: 'MaintenanceRecord',
      entityId: record._id,
      changes: req.body,
    });

    return sendSuccess(res, record, 'Maintenance ticket updated');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 6. SOFTWARE LICENSES & KEYS
// ==========================================

export const listLicenses = async (req, res, next) => {
  try {
    const canViewCost =
      req.permissions?.includes('*') ||
      req.permissions?.includes('asset.viewCost') ||
      ['super_admin', 'admin', 'it_admin'].includes(req.userRole);

    const licenses = await SoftwareLicense.find()
      .populate('assignedTo.employee', 'personal.firstName personal.lastName employeeId personal.photo')
      .sort({ renewalDate: 1 })
      .lean();

    licenses.forEach((lic) => {
      // Mask license key strictly
      lic.licenseKey = lic.licenseKey ? '••••••••••••••••••••' : '';
      if (!canViewCost) {
        delete lic.cost;
      }
    });

    return sendSuccess(res, licenses, 'Software licenses retrieved');
  } catch (err) {
    next(err);
  }
};

export const getLicenseSummary = async (req, res, next) => {
  try {
    const licenses = await SoftwareLicense.find({ status: { $ne: 'cancelled' } });
    const totalLicenses = licenses.length;
    const totalSeats = licenses.reduce((sum, l) => sum + (l.totalSeats || 0), 0);
    const usedSeats = licenses.reduce((sum, l) => sum + (l.usedSeats || 0), 0);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const renewalsThisMonth = licenses.filter(
      (l) => l.renewalDate && l.renewalDate >= now && l.renewalDate <= in30Days
    ).length;

    return sendSuccess(res, {
      totalLicenses,
      totalSeats,
      usedSeats,
      renewalsThisMonth,
    });
  } catch (err) {
    next(err);
  }
};

export const createLicense = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (!data.name || !data.vendor || !data.totalSeats || !data.renewalDate) {
      return sendError(res, 'Name, vendor, totalSeats, and renewalDate are required', 400);
    }

    if (data.licenseKey) {
      data.licenseKey = encryptLicenseKey(data.licenseKey);
    }

    const license = await SoftwareLicense.create(data);

    await logAudit({
      req,
      action: 'CREATE_SOFTWARE_LICENSE',
      entity: 'SoftwareLicense',
      entityId: license._id,
      changes: { name: license.name, vendor: license.vendor },
    });

    return sendSuccess(res, license, 'License created successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateLicense = async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = { ...req.body };

    if (update.licenseKey) {
      update.licenseKey = encryptLicenseKey(update.licenseKey);
    }

    const license = await SoftwareLicense.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!license) return sendError(res, 'License not found', 404);

    await logAudit({
      req,
      action: 'UPDATE_SOFTWARE_LICENSE',
      entity: 'SoftwareLicense',
      entityId: license._id,
      changes: req.body,
    });

    return sendSuccess(res, license, 'License updated');
  } catch (err) {
    next(err);
  }
};

export const deleteLicense = async (req, res, next) => {
  try {
    await SoftwareLicense.findByIdAndDelete(req.params.id);
    return sendSuccess(res, null, 'License deleted');
  } catch (err) {
    next(err);
  }
};

export const revealLicenseKey = async (req, res, next) => {
  try {
    const license = await SoftwareLicense.findById(req.params.id);
    if (!license) return sendError(res, 'License not found', 404);

    const decryptedKey = decryptLicenseKey(license.licenseKey);

    // CRITICAL: Audit log every license key reveal
    await logAudit({
      req,
      action: 'REVEAL_LICENSE_KEY',
      entity: 'SoftwareLicense',
      entityId: license._id,
      changes: { licenseName: license.name },
    });

    return sendSuccess(res, { key: decryptedKey }, 'License key revealed');
  } catch (err) {
    next(err);
  }
};

export const assignLicenseSeat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;

    const license = await SoftwareLicense.findById(id);
    if (!license) return sendError(res, 'License not found', 404);

    if (license.usedSeats >= license.totalSeats) {
      return sendError(
        res,
        `All ${license.totalSeats} seats for "${license.name}" are currently allocated. Upgrade seats to add more.`,
        400
      );
    }

    const alreadyAssigned = (license.assignedTo || []).some(
      (a) => a.employee.toString() === employeeId.toString()
    );
    if (alreadyAssigned) {
      return sendError(res, 'Employee already has an allocated seat for this license', 400);
    }

    license.assignedTo.push({ employee: employeeId, assignedAt: new Date() });
    await license.save();

    await logAudit({
      req,
      action: 'ASSIGN_LICENSE_SEAT',
      entity: 'SoftwareLicense',
      entityId: license._id,
      changes: { employeeId },
    });

    return sendSuccess(res, license, 'Seat assigned successfully');
  } catch (err) {
    next(err);
  }
};

export const revokeLicenseSeat = async (req, res, next) => {
  try {
    const { id, empId } = req.params;
    const license = await SoftwareLicense.findById(id);
    if (!license) return sendError(res, 'License not found', 404);

    license.assignedTo = (license.assignedTo || []).filter(
      (a) => a.employee.toString() !== empId.toString()
    );
    await license.save();

    // Check exit clearance
    const clearance = await ExitClearance.findOne({ employee: empId });
    if (clearance) {
      const item = clearance.checklist.find(
        (c) => c.itemType === 'license' && c.referenceId.toString() === license._id.toString()
      );
      if (item) {
        item.status = 'revoked';
        item.resolvedAt = new Date();
        await clearance.save();
      }
    }

    await logAudit({
      req,
      action: 'REVOKE_LICENSE_SEAT',
      entity: 'SoftwareLicense',
      entityId: license._id,
      changes: { empId },
    });

    return sendSuccess(res, license, 'Seat revoked successfully');
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. EXIT CLEARANCE
// ==========================================

export const getExitClearance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    let clearance = await ExitClearance.findOne({ employee: employeeId })
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('clearedBy', 'email');

    if (!clearance) {
      clearance = await initiateExitClearance(employeeId);
    }

    return sendSuccess(res, clearance, 'Exit clearance details');
  } catch (err) {
    next(err);
  }
};

export const resolveClearanceItem = async (req, res, next) => {
  try {
    const { employeeId, itemId } = req.params;
    const { status, conditionAtReturn, note } = req.body;

    const clearance = await ExitClearance.findOne({ employee: employeeId });
    if (!clearance) return sendError(res, 'Clearance record not found', 404);

    const item = clearance.checklist.id(itemId);
    if (!item) return sendError(res, 'Checklist item not found', 404);

    item.status = status;
    item.conditionAtReturn = conditionAtReturn || 'good';
    item.note = note || '';
    item.resolvedAt = new Date();

    // If it's a physical asset and marked returned, update the asset as available
    if (item.itemType === 'asset' && status === 'returned') {
      const asset = await Asset.findById(item.referenceId);
      if (asset) {
        asset.status = conditionAtReturn === 'poor' ? 'under_repair' : 'available';
        asset.condition = conditionAtReturn || asset.condition;
        asset.currentAssignee = null;
        await asset.save();
      }

      await AssetAssignment.updateMany(
        { asset: item.referenceId, employee: employeeId, status: 'active' },
        {
          $set: {
            status: 'returned',
            returnedAt: new Date(),
            receivedBy: req.user._id,
            conditionAtReturn: conditionAtReturn || 'good',
            returnNotes: note || '',
          },
        }
      );
    } else if (item.itemType === 'asset' && status === 'lost') {
      await Asset.findByIdAndUpdate(item.referenceId, {
        status: 'lost',
        currentAssignee: null,
      });
      await AssetAssignment.updateMany(
        { asset: item.referenceId, employee: employeeId, status: 'active' },
        { $set: { status: 'lost', returnedAt: new Date(), returnNotes: note || 'Marked lost' } }
      );
    } else if (item.itemType === 'license' && status === 'revoked') {
      await SoftwareLicense.findByIdAndUpdate(item.referenceId, {
        $pull: { assignedTo: { employee: employeeId } },
      });
    }

    const allResolved = clearance.checklist.every((c) => c.status !== 'pending');
    if (allResolved) {
      clearance.status = 'cleared';
      clearance.clearedAt = new Date();
      clearance.clearedBy = req.user._id;
    }

    await clearance.save();

    await logAudit({
      req,
      action: 'RESOLVE_CLEARANCE_ITEM',
      entity: 'ExitClearance',
      entityId: clearance._id,
      changes: { item: item.name, status },
    });

    return sendSuccess(res, clearance, 'Checklist item resolved');
  } catch (err) {
    next(err);
  }
};

export const completeExitClearance = async (req, res, next) => {
  try {
    const { employeeId } = req.params;
    const clearance = await ExitClearance.findOne({ employee: employeeId });
    if (!clearance) return sendError(res, 'Clearance record not found', 404);

    const pendingItems = clearance.checklist.filter((c) => c.status === 'pending');
    if (pendingItems.length > 0) {
      return sendError(
        res,
        `Cannot complete exit clearance: ${pendingItems.length} items are still unreturned or unrevoked (${pendingItems.map((p) => p.name).join(', ')}).`,
        400
      );
    }

    clearance.status = 'cleared';
    clearance.clearedAt = new Date();
    clearance.clearedBy = req.user._id;
    await clearance.save();

    await logAudit({
      req,
      action: 'COMPLETE_EXIT_CLEARANCE',
      entity: 'ExitClearance',
      entityId: clearance._id,
    });

    return sendSuccess(res, clearance, 'Exit clearance completed successfully');
  } catch (err) {
    next(err);
  }
};
