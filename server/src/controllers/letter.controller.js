import crypto from 'crypto';
import mongoose from 'mongoose';
import { LetterTemplate } from '../models/LetterTemplate.js';
import { IssuedLetter } from '../models/IssuedLetter.js';
import { Employee } from '../models/Employee.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import { createApprovalRequest } from '../services/approval.service.js';
import { generateLetterPdfBuffer } from '../services/letterPdf.service.js';
import {
  renderTemplateBody,
  validateTemplateVariables,
  computeDocumentHash,
} from '../services/letterTemplate.service.js';
import {
  getNextLetterRefNo,
  seedStandardTemplates,
} from '../services/letterIssuance.service.js';

/**
 * 1. GET /api/v1/letters/templates - List all letter templates
 */
export const getTemplates = async (req, res, next) => {
  try {
    const { category, status } = req.query;
    let query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    else query.status = { $ne: 'archived' };

    let templates = await LetterTemplate.find(query).sort({ createdAt: -1 });

    // Auto-seed sample templates if empty
    if (templates.length === 0) {
      await seedStandardTemplates(req.user?._id);
      templates = await LetterTemplate.find(query).sort({ createdAt: -1 });
    }

    return sendSuccess(res, templates, 'Letter templates retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 2. POST /api/v1/letters/templates - Create template
 */
export const createTemplate = async (req, res, next) => {
  try {
    const { name, code, category, body, signatory, requiresApproval } = req.body;

    const validation = validateTemplateVariables(body);
    if (!validation.isValid) {
      return sendError(
        res,
        `Template contains unknown or invalid variables: ${validation.unknownVariables.join(', ')}`,
        400
      );
    }

    const template = await LetterTemplate.create({
      name,
      code,
      category,
      body,
      signatory,
      requiresApproval: requiresApproval !== undefined ? requiresApproval : true,
      createdBy: req.user._id,
      isReviewed: false,
    });

    await logAudit({
      req,
      action: 'CREATE_LETTER_TEMPLATE',
      entity: 'LetterTemplate',
      entityId: template._id,
      changes: { code, category },
    });

    return sendSuccess(res, template, 'Letter template created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 3. POST /api/v1/letters/templates/:id/review - Mark template reviewed
 */
export const reviewTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const template = await LetterTemplate.findById(id);
    if (!template) return sendError(res, 'Template not found', 404);

    template.isReviewed = true;
    template.reviewedBy = req.user._id;
    template.reviewedAt = new Date();
    await template.save();

    await logAudit({
      req,
      action: 'REVIEW_LETTER_TEMPLATE',
      entity: 'LetterTemplate',
      entityId: template._id,
    });

    return sendSuccess(res, template, 'Letter template reviewed and marked safe for official issuance');
  } catch (err) {
    next(err);
  }
};

/**
 * 4. POST /api/v1/letters/generate - Generate Letter (single or bulk)
 */
export const generateLetter = async (req, res, next) => {
  try {
    const {
      templateId,
      employeeId,
      candidate,
      extraFields = {},
      action = 'draft', // 'draft', 'submit', 'issue'
    } = req.body;

    const template = await LetterTemplate.findById(templateId);
    if (!template) return sendError(res, 'Letter template not found', 404);

    // Safeguard: Real employees cannot receive unreviewed sample templates without Super Admin role
    const isSuperAdmin = req.userRole === 'super_admin' || req.user?.role?.key === 'super_admin';
    if (template.isSample && !template.isReviewed && !isSuperAdmin) {
      return sendError(
        res,
        'Cannot generate letter from unreviewed SAMPLE template. Have legal/HR review and mark it reviewed first.',
        400
      );
    }

    let employee = null;
    if (employeeId) {
      employee = await Employee.findById(employeeId)
        .populate('employment.department')
        .populate('employment.reportingManager');
      if (!employee) return sendError(res, 'Employee not found', 404);
    }

    const refNo = await getNextLetterRefNo(template.category);
    const verificationToken = crypto.randomBytes(16).toString('hex');
    const canReadSalary = req.permissions?.includes('*') || req.permissions?.includes('employee.readSalary');

    const renderedBody = renderTemplateBody({
      templateBody: template.body,
      employee,
      signatory: template.signatory,
      letter: { refNo, date: extraFields.date || new Date() },
      extraFields,
      canReadSalary,
    });

    const docHash = computeDocumentHash(renderedBody);
    let status = 'draft';

    if (action === 'issue') {
      if (template.requiresApproval) {
        status = 'pending_approval';
      } else {
        status = 'issued';
      }
    } else if (action === 'submit') {
      status = 'pending_approval';
    }

    const letter = await IssuedLetter.create({
      refNo,
      template: template._id,
      templateVersion: template.version,
      category: template.category,
      title: template.name,
      employee: employee ? employee._id : null,
      candidate: candidate || {},
      extraFields,
      renderedBody,
      status,
      documentHash: docHash,
      verificationToken,
      issuedAt: status === 'issued' ? new Date() : null,
      issuedBy: status === 'issued' ? req.user._id : null,
      versions: [
        {
          version: 1,
          renderedBody,
          documentHash: docHash,
          createdBy: req.user._id,
        },
      ],
    });

    // If approval required, create approval request
    if (status === 'pending_approval') {
      const appr = await createApprovalRequest({
        type: 'letter',
        referenceModel: 'IssuedLetter',
        referenceId: letter._id,
        requestedByEmployeeId: employee ? employee._id : req.user.employee?._id,
        requesterUserId: req.user._id,
        title: `Official Letter Approval: ${template.name} for ${employee ? employee.fullName : candidate?.name || 'Applicant'}`,
        metadata: {
          refNo: letter.refNo,
          categoryLabel: template.name,
        },
      });
      letter.approvalRequest = appr._id;
      await letter.save();
    }

    await logAudit({
      req,
      action: 'GENERATE_LETTER',
      entity: 'IssuedLetter',
      entityId: letter._id,
      changes: { refNo, status, template: template.code },
    });

    return sendSuccess(res, letter, `Letter generated successfully (Status: ${status})`, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 5. GET /api/v1/letters - List Issued Letters & Drafts
 */
export const listLetters = async (req, res, next) => {
  try {
    const { status, category, employeeId, page = 1, limit = 20 } = req.query;

    const userRole = req.userRole || (req.user?.role?.key || 'employee');
    const isSuperAdmin = userRole === 'super_admin';
    const isHR = userRole === 'hr';
    const myEmpId = req.user.employee?._id;

    let query = {};
    if (!isSuperAdmin && !isHR) {
      // Employees see only letters issued to themselves
      if (!myEmpId) return sendSuccess(res, { letters: [], total: 0 });
      query.employee = myEmpId;
      query.status = { $in: ['issued', 'revoked'] };
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (employeeId && (isSuperAdmin || isHR)) query.employee = employeeId;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, letters] = await Promise.all([
      IssuedLetter.countDocuments(query),
      IssuedLetter.find(query)
        .populate('employee', 'personal.firstName personal.lastName employeeId')
        .populate('template', 'name code category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    return sendSuccess(
      res,
      {
        letters,
        pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) || 1, limit: limitNum },
      },
      'Letters retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 6. GET /api/v1/letters/:id - Get Letter Details
 */
export const getLetterById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const letter = await IssuedLetter.findById(id)
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('template')
      .populate('issuedBy', 'email');

    if (!letter) return sendError(res, 'Letter record not found', 404);

    return sendSuccess(res, letter, 'Letter retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 7. GET /api/v1/letters/:id/pdf - Stream PDF buffer
 */
export const streamLetterPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const letter = await IssuedLetter.findById(id)
      .populate('template')
      .populate('employee');

    if (!letter) return sendError(res, 'Letter not found', 404);

    const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/verify/${letter.verificationToken}`;

    const pdfBuffer = await generateLetterPdfBuffer({
      title: letter.title,
      refNo: letter.refNo,
      date: letter.issuedAt || letter.createdAt,
      renderedBody: letter.renderedBody,
      signatory: letter.template?.signatory,
      verificationUrl,
      isSample: Boolean(letter.template?.isSample && !letter.template?.isReviewed),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${letter.refNo.replace(/\//g, '_')}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * 8. POST /api/v1/letters/:id/revoke - Revoke issued letter
 */
export const revokeLetter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, 'A justification reason is mandatory to revoke an issued document', 400);
    }

    const letter = await IssuedLetter.findById(id);
    if (!letter) return sendError(res, 'Letter not found', 404);

    letter.status = 'revoked';
    letter.revokedAt = new Date();
    letter.revokedBy = req.user._id;
    letter.revocationReason = reason;
    await letter.save();

    await logAudit({
      req,
      action: 'REVOKE_LETTER',
      entity: 'IssuedLetter',
      entityId: id,
      changes: { reason },
    });

    return sendSuccess(res, letter, 'Document revoked successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 9. GET /api/v1/verify/:token - Public Verification Endpoint
 */
export const verifyPublicLetter = async (req, res, next) => {
  try {
    const { token } = req.params;
    const letter = await IssuedLetter.findOne({ verificationToken: token })
      .populate('employee', 'personal.firstName personal.lastName employeeId');

    if (!letter) {
      return sendError(res, 'Invalid or unrecognized document verification token', 404);
    }

    return sendSuccess(res, {
      isValid: letter.status === 'issued',
      status: letter.status,
      refNo: letter.refNo,
      title: letter.title,
      issuedTo: letter.employee ? `${letter.employee.personal?.firstName} ${letter.employee.personal?.lastName}` : letter.candidate?.name || 'Individual',
      issuedDate: letter.issuedAt || letter.createdAt,
      revokedAt: letter.revokedAt,
      revocationReason: letter.revocationReason,
    }, 'Document verification details retrieved');
  } catch (err) {
    next(err);
  }
};
