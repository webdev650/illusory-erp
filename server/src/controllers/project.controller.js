import { z } from 'zod';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Employee from '../models/Employee.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';

/**
 * Mask budget, billing rates, and milestone amounts if user lacks project.viewBudget
 */
export const maskProjectFinancials = (project, permissions = []) => {
  const canView = permissions.includes('*') || permissions.includes('project.viewBudget');
  if (canView) return project;

  const copy = typeof project.toObject === 'function' ? project.toObject() : { ...project };
  delete copy.budget;
  if (Array.isArray(copy.members)) {
    copy.members = copy.members.map((m) => {
      const mCopy = typeof m.toObject === 'function' ? m.toObject() : { ...m };
      delete mCopy.billingRatePerHour;
      return mCopy;
    });
  }
  if (Array.isArray(copy.milestones)) {
    copy.milestones = copy.milestones.map((ms) => {
      const msCopy = typeof ms.toObject === 'function' ? ms.toObject() : { ...ms };
      delete msCopy.amount;
      return msCopy;
    });
  }
  return copy;
};

/**
 * Helper to recalculate project progress from done tasks / total tasks
 */
export const recalculateProjectProgress = async (projectId) => {
  const totalTasks = await Task.countDocuments({ project: projectId, isDeleted: false });
  const doneTasks = await Task.countDocuments({
    project: projectId,
    status: 'done',
    isDeleted: false,
  });
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  await Project.findByIdAndUpdate(projectId, { progressPercent });
  return progressPercent;
};

// Zod schemas
const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name is required'),
  client: z.string().min(1, 'Client ID is required'),
  description: z.string().optional(),
  type: z
    .enum(['website', 'branding', 'app', 'social_media', 'marketing', 'video', 'other'])
    .optional()
    .default('website'),
  status: z
    .enum(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
    .optional()
    .default('planning'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  projectManager: z.string().min(1, 'Project Manager ID is required'),
  members: z
    .array(
      z.object({
        employee: z.string(),
        roleInProject: z.string().optional().default('Team Member'),
        allocationPercent: z.number().min(0).max(100).optional().default(100),
        billingRatePerHour: z.number().min(0).optional().default(0), // in paise
      })
    )
    .optional()
    .default([]),
  budget: z
    .object({
      amount: z.number().min(0).optional().default(0), // in paise
      currency: z.string().optional().default('INR'),
      estimatedHours: z.number().min(0).optional().default(0),
    })
    .optional(),
  milestones: z
    .array(
      z.object({
        name: z.string(),
        dueDate: z.string().optional(),
        status: z.enum(['pending', 'done']).optional().default('pending'),
        amount: z.number().min(0).optional().default(0), // in paise
      })
    )
    .optional()
    .default([]),
  tags: z.array(z.string()).optional().default([]),
});

/**
 * List projects with filters, pagination, and RBAC visibility
 * GET /api/v1/projects
 */
export const getProjects = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      client,
      manager,
      member,
      type,
      priority,
      startDate,
      dueDate,
    } = req.query;

    const query = { isDeleted: false };

    // RBAC: If user only has project.readOwn, restrict to projects they manage or are member of
    const hasFullRead =
      req.permissions?.includes('*') || req.permissions?.includes('project.read');
    if (!hasFullRead) {
      if (!req.user?.employee) {
        return sendSuccess(res, 'No projects found', {
          projects: [],
          pagination: { total: 0, page: 1, limit: 20, pages: 0 },
        });
      }
      query.$or = [
        { projectManager: req.user.employee },
        { 'members.employee': req.user.employee },
      ];
    }

    if (status) query.status = status;
    if (client) query.client = client;
    if (manager) query.projectManager = manager;
    if (member) query['members.employee'] = member;
    if (type) query.type = type;
    if (priority) query.priority = priority;

    if (startDate) query.startDate = { $gte: new Date(startDate) };
    if (dueDate) query.dueDate = { $lte: new Date(dueDate) };

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchCondition = [
        { name: searchRegex },
        { projectCode: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchCondition }];
        delete query.$or;
      } else {
        query.$or = searchCondition;
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Project.countDocuments(query);

    const projects = await Project.find(query)
      .populate('client', 'name companyName logo')
      .populate('projectManager', 'personal.firstName personal.lastName employment.designation personal.photo')
      .populate('members.employee', 'personal.firstName personal.lastName employment.designation personal.photo')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    // Mask financial fields if user lacks project.viewBudget
    const sanitizedProjects = projects.map((p) => maskProjectFinancials(p, req.permissions));

    return sendSuccess(res, 'Projects retrieved successfully', {
      projects: sanitizedProjects,
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
 * Get projects for logged in user (manager or member)
 * GET /api/v1/projects/my
 */
export const getMyProjects = async (req, res, next) => {
  try {
    if (!req.user?.employee) {
      return sendSuccess(res, 'My projects retrieved', { projects: [] });
    }

    const query = {
      isDeleted: false,
      $or: [
        { projectManager: req.user.employee },
        { 'members.employee': req.user.employee },
      ],
    };

    const projects = await Project.find(query)
      .populate('client', 'name companyName logo')
      .populate('projectManager', 'personal.firstName personal.lastName employment.designation personal.photo')
      .populate('members.employee', 'personal.firstName personal.lastName employment.designation personal.photo')
      .sort({ dueDate: 1 })
      .lean();

    const sanitizedProjects = projects.map((p) => maskProjectFinancials(p, req.permissions));
    return sendSuccess(res, 'My projects retrieved', { projects: sanitizedProjects });
  } catch (err) {
    next(err);
  }
};

/**
 * Projects summary dashboard
 * GET /api/v1/projects/summary
 */
export const getProjectsSummary = async (req, res, next) => {
  try {
    const filter = { isDeleted: false };
    const hasFullRead =
      req.permissions?.includes('*') || req.permissions?.includes('project.read');
    if (!hasFullRead && req.user?.employee) {
      filter.$or = [
        { projectManager: req.user.employee },
        { 'members.employee': req.user.employee },
      ];
    }

    const projects = await Project.find(filter).lean();
    const projectIds = projects.map((p) => p._id);

    // Status counts
    const statusCounts = {
      planning: 0,
      active: 0,
      on_hold: 0,
      completed: 0,
      cancelled: 0,
      total: projects.length,
    };
    projects.forEach((p) => {
      if (statusCounts[p.status] !== undefined) {
        statusCounts[p.status]++;
      }
    });

    // Task metrics for these projects
    const now = new Date();
    const overdueTasksCount = await Task.countDocuments({
      project: { $in: projectIds },
      status: { $ne: 'done' },
      dueDate: { $lt: now },
      isDeleted: false,
    });

    const activeTasksCount = await Task.countDocuments({
      project: { $in: projectIds },
      status: { $in: ['in_progress', 'todo', 'in_review'] },
      isDeleted: false,
    });

    // Upcoming project deadlines (next 14 days)
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const upcomingDeadlines = await Project.find({
      ...filter,
      status: { $in: ['active', 'planning'] },
      dueDate: { $gte: now, $lte: inTwoWeeks },
    })
      .select('projectCode name dueDate priority status progressPercent')
      .populate('client', 'name')
      .sort({ dueDate: 1 })
      .limit(6)
      .lean();

    // Workload per employee (active tasks assigned)
    const workloadAggregation = await Task.aggregate([
      {
        $match: {
          project: { $in: projectIds },
          status: { $ne: 'done' },
          isDeleted: false,
        },
      },
      { $unwind: '$assignees' },
      {
        $group: {
          _id: '$assignees',
          taskCount: { $sum: 1 },
          estimatedHours: { $sum: '$estimatedHours' },
        },
      },
      { $sort: { taskCount: -1 } },
      { $limit: 8 },
    ]);

    await Employee.populate(workloadAggregation, {
      path: '_id',
      select: 'personal.firstName personal.lastName employment.designation personal.photo',
    });

    const workload = workloadAggregation
      .filter((w) => w._id)
      .map((w) => ({
        employee: w._id,
        taskCount: w.taskCount,
        estimatedHours: w.estimatedHours,
      }));

    return sendSuccess(res, 'Project summary retrieved', {
      statusCounts,
      activeTasksCount,
      overdueTasksCount,
      upcomingDeadlines,
      workload,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get project by ID with full details, team, milestones, and task counts
 * GET /api/v1/projects/:id
 */
export const getProjectById = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: false })
      .populate('client', 'name companyName email phone contactPerson logo')
      .populate('projectManager', 'personal.firstName personal.lastName employment.designation personal.photo personal.officialEmail')
      .populate('members.employee', 'personal.firstName personal.lastName employment.designation personal.photo personal.officialEmail')
      .lean();

    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // RBAC: Check if user has permission to view this project
    const hasFullRead =
      req.permissions?.includes('*') || req.permissions?.includes('project.read');
    if (!hasFullRead) {
      const userEmpId = req.user?.employee?.toString();
      const isManager = project.projectManager?._id?.toString() === userEmpId;
      const isMember = project.members?.some(
        (m) => m.employee?._id?.toString() === userEmpId
      );
      if (!isManager && !isMember) {
        return sendError(res, 'You do not have access to view this project', 403);
      }
    }

    // Task statistics for this project
    const taskStats = await Task.aggregate([
      { $match: { project: project._id, isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const taskCounts = {
      backlog: 0,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
      blocked: 0,
      total: 0,
    };

    taskStats.forEach((ts) => {
      if (taskCounts[ts._id] !== undefined) {
        taskCounts[ts._id] = ts.count;
      }
      taskCounts.total += ts.count;
    });

    const sanitized = maskProjectFinancials(project, req.permissions);
    sanitized.taskCounts = taskCounts;

    return sendSuccess(res, 'Project retrieved successfully', sanitized);
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new project
 * POST /api/v1/projects
 */
export const createProject = async (req, res, next) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    const projectData = { ...parsed.data };
    const project = await Project.create(projectData);

    await logAudit({
      user: req.user?._id,
      action: 'PROJECT_CREATE',
      resource: 'Project',
      resourceId: project._id,
      details: { projectCode: project.projectCode, name: project.name },
    });

    return sendSuccess(res, 'Project created successfully', project, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update an existing project
 * PUT /api/v1/projects/:id
 */
export const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    // Check project management permission
    const hasFullManage =
      req.permissions?.includes('*') || req.permissions?.includes('project.update');
    const isManager = project.projectManager?.toString() === req.user?.employee?.toString();
    if (!hasFullManage && !isManager) {
      return sendError(res, 'You do not have permission to update this project', 403);
    }

    const parsed = createProjectSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    // Do not allow budget update if user lacks project.viewBudget / manage
    if (parsed.data.budget && !req.permissions?.includes('*') && !req.permissions?.includes('project.viewBudget')) {
      delete parsed.data.budget;
    }

    Object.assign(project, parsed.data);
    await project.save();

    await logAudit({
      user: req.user?._id,
      action: 'PROJECT_UPDATE',
      resource: 'Project',
      resourceId: project._id,
      details: parsed.data,
    });

    return sendSuccess(res, 'Project updated successfully', project);
  } catch (err) {
    next(err);
  }
};

/**
 * Change project status
 * PATCH /api/v1/projects/:id/status
 */
export const changeProjectStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(status)) {
      return sendError(res, 'Invalid project status', 400);
    }

    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    const oldStatus = project.status;
    project.status = status;
    if (status === 'completed') {
      project.completedAt = new Date();
    } else {
      project.completedAt = null;
    }
    await project.save();

    await logAudit({
      user: req.user?._id,
      action: 'PROJECT_STATUS_CHANGE',
      resource: 'Project',
      resourceId: project._id,
      details: { from: oldStatus, to: status },
    });

    return sendSuccess(res, `Project status changed to ${status}`, project);
  } catch (err) {
    next(err);
  }
};

/**
 * Add member to project
 * POST /api/v1/projects/:id/members
 */
export const addProjectMember = async (req, res, next) => {
  try {
    const { employeeId, roleInProject, allocationPercent, billingRatePerHour } = req.body;
    if (!employeeId) {
      return sendError(res, 'Employee ID is required', 400);
    }

    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    const alreadyMember = project.members.some(
      (m) => m.employee.toString() === employeeId
    );
    if (alreadyMember) {
      return sendError(res, 'Employee is already a member of this project', 400);
    }

    project.members.push({
      employee: employeeId,
      roleInProject: roleInProject || 'Team Member',
      allocationPercent: allocationPercent !== undefined ? allocationPercent : 100,
      billingRatePerHour: billingRatePerHour || 0,
    });

    await project.save();

    await logAudit({
      user: req.user?._id,
      action: 'PROJECT_MEMBER_ADD',
      resource: 'Project',
      resourceId: project._id,
      details: { employeeId, roleInProject },
    });

    return sendSuccess(res, 'Project member added successfully', project.members);
  } catch (err) {
    next(err);
  }
};

/**
 * Remove member from project
 * DELETE /api/v1/projects/:id/members/:employeeId
 */
export const removeProjectMember = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) {
      return sendError(res, 'Project not found', 404);
    }

    project.members = project.members.filter(
      (m) => m.employee.toString() !== req.params.employeeId
    );
    await project.save();

    await logAudit({
      user: req.user?._id,
      action: 'PROJECT_MEMBER_REMOVE',
      resource: 'Project',
      resourceId: project._id,
      details: { employeeId: req.params.employeeId },
    });

    return sendSuccess(res, 'Member removed from project', project.members);
  } catch (err) {
    next(err);
  }
};

/**
 * Add / Update milestone
 * POST /api/v1/projects/:id/milestones
 * PUT /api/v1/projects/:id/milestones/:milestoneId
 */
export const addMilestone = async (req, res, next) => {
  try {
    const { name, dueDate, status, amount } = req.body;
    if (!name) return sendError(res, 'Milestone name is required', 400);

    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) return sendError(res, 'Project not found', 404);

    project.milestones.push({
      name,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: status || 'pending',
      amount: amount || 0,
    });

    await project.save();
    return sendSuccess(res, 'Milestone added', project.milestones);
  } catch (err) {
    next(err);
  }
};

export const updateMilestone = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) return sendError(res, 'Project not found', 404);

    const milestone = project.milestones.id(req.params.milestoneId);
    if (!milestone) return sendError(res, 'Milestone not found', 404);

    if (req.body.name) milestone.name = req.body.name;
    if (req.body.dueDate) milestone.dueDate = new Date(req.body.dueDate);
    if (req.body.status) milestone.status = req.body.status;
    if (req.body.amount !== undefined) milestone.amount = req.body.amount;

    await project.save();
    return sendSuccess(res, 'Milestone updated', milestone);
  } catch (err) {
    next(err);
  }
};

/**
 * Upload project attachment
 * POST /api/v1/projects/:id/attachments
 */
export const uploadProjectAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, 'No file uploaded', 400);
    }

    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) return sendError(res, 'Project not found', 404);

    const attachment = {
      name: req.file.originalname || 'Attachment',
      url: req.file.path || req.file.secure_url,
      publicId: req.file.filename || req.file.public_id,
      size: req.file.size || 0,
      uploadedAt: new Date(),
      uploadedBy: req.user?._id,
    };

    project.attachments.push(attachment);
    await project.save();

    await logAudit({
      user: req.user?._id,
      action: 'PROJECT_ATTACHMENT_UPLOAD',
      resource: 'Project',
      resourceId: project._id,
      details: { fileName: attachment.name },
    });

    return sendSuccess(res, 'File uploaded to project successfully', attachment, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Soft delete project
 * DELETE /api/v1/projects/:id
 */
export const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, isDeleted: false });
    if (!project) return sendError(res, 'Project not found', 404);

    project.isDeleted = true;
    await project.save();

    await logAudit({
      user: req.user?._id,
      action: 'PROJECT_DELETE',
      resource: 'Project',
      resourceId: project._id,
      details: { name: project.name, projectCode: project.projectCode },
    });

    return sendSuccess(res, 'Project deleted successfully', null);
  } catch (err) {
    next(err);
  }
};
