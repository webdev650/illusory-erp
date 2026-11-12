import { z } from 'zod';
import Client from '../models/Client.js';
import Project from '../models/Project.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

const clientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  industry: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  notes: z.string().optional(),
});

/**
 * List clients with search, status filter, and pagination
 * GET /api/v1/clients
 */
export const getClients = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;
    const query = { isDeleted: false };

    if (status && ['active', 'inactive'].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Client.countDocuments(query);
    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    // Attach active project counts
    const clientIds = clients.map((c) => c._id);
    const projectCounts = await Project.aggregate([
      { $match: { client: { $in: clientIds }, isDeleted: false } },
      { $group: { _id: '$client', total: { $sum: 1 }, active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } } } },
    ]);

    const countMap = {};
    projectCounts.forEach((pc) => {
      countMap[pc._id.toString()] = pc;
    });

    const clientsWithProjects = clients.map((c) => ({
      ...c,
      projectStats: countMap[c._id.toString()] || { total: 0, active: 0 },
    }));

    return sendSuccess(res, 'Clients retrieved successfully', {
      clients: clientsWithProjects,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get client by ID with associated projects
 * GET /api/v1/clients/:id
 */
export const getClientById = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, isDeleted: false })
      .populate('createdBy', 'email')
      .lean();

    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const projects = await Project.find({ client: client._id, isDeleted: false })
      .populate('projectManager', 'personal.firstName personal.lastName employment.designation')
      .select('projectCode name status type progressPercent startDate dueDate budget')
      .sort({ createdAt: -1 })
      .lean();

    // Check if user has budget view permission
    const canViewBudget = req.permissions?.includes('*') || req.permissions?.includes('project.viewBudget');
    const sanitizedProjects = projects.map((p) => {
      if (!canViewBudget) {
        delete p.budget;
      }
      return p;
    });

    return sendSuccess(res, 'Client details retrieved', {
      client,
      projects: sanitizedProjects,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new client
 * POST /api/v1/clients
 */
export const createClient = async (req, res, next) => {
  try {
    const parsed = clientSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    const clientData = {
      ...parsed.data,
      createdBy: req.user?._id,
    };

    if (req.file) {
      clientData.logo = {
        url: req.file.path || req.file.secure_url,
        publicId: req.file.filename || req.file.public_id,
      };
    }

    const client = await Client.create(clientData);

    await logAudit({
      user: req.user?._id,
      action: 'CLIENT_CREATE',
      resource: 'Client',
      resourceId: client._id,
      details: { name: client.name, companyName: client.companyName },
    });

    return sendSuccess(res, 'Client created successfully', client, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing client
 * PUT /api/v1/clients/:id
 */
export const updateClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, isDeleted: false });
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    const parsed = clientSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    Object.assign(client, parsed.data);

    if (req.file) {
      client.logo = {
        url: req.file.path || req.file.secure_url,
        publicId: req.file.filename || req.file.public_id,
      };
    }

    await client.save();

    await logAudit({
      user: req.user?._id,
      action: 'CLIENT_UPDATE',
      resource: 'Client',
      resourceId: client._id,
      details: parsed.data,
    });

    return sendSuccess(res, 'Client updated successfully', client);
  } catch (err) {
    next(err);
  }
};

/**
 * Soft delete client
 * DELETE /api/v1/clients/:id
 */
export const deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, isDeleted: false });
    if (!client) {
      return sendError(res, 'Client not found', 404);
    }

    client.isDeleted = true;
    await client.save();

    await logAudit({
      user: req.user?._id,
      action: 'CLIENT_DELETE',
      resource: 'Client',
      resourceId: client._id,
      details: { name: client.name },
    });

    return sendSuccess(res, 'Client deleted successfully', null);
  } catch (err) {
    next(err);
  }
};
