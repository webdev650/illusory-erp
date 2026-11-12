import { z } from 'zod';
import Task from '../models/Task.js';
import TaskComment from '../models/TaskComment.js';
import TaskActivity from '../models/TaskActivity.js';
import Project from '../models/Project.js';
import Employee from '../models/Employee.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import { recalculateProjectProgress } from './project.controller.js';
import { notifyEmployee } from '../services/notification.service.js';

/**
 * Helper to check whether user is authorized to edit a specific task
 * Super Admin & Admin can edit all tasks.
 * Project Managers can edit tasks in projects they manage.
 * Employees can edit tasks assigned to them or reported by them.
 */
export const canUserEditTask = async (task, req) => {
  if (!task || !req.user) return false;
  const isSuperAdminOrAdmin =
    req.permissions?.includes('*') ||
    ['super_admin', 'admin'].includes(req.userRole) ||
    ['super_admin', 'admin'].includes(req.user?.role?.key);
  if (isSuperAdminOrAdmin) return true;

  const userEmpId = req.user.employee?.toString();
  if (!userEmpId) return false;

  const isAssignee = Array.isArray(task.assignees) && task.assignees.some((a) => a.toString() === userEmpId);
  const isReporter = task.reporter?.toString() === userEmpId;
  if (isAssignee || isReporter) return true;

  const project = await Project.findById(task.project).select('projectManager');
  if (project?.projectManager?.toString() === userEmpId) return true;

  return false;
};

// Zod schemas
const taskSchema = z.object({
  title: z.string().min(2, 'Task title is required'),
  description: z.string().optional(),
  project: z.string().min(1, 'Project ID is required'),
  assignees: z.array(z.string()).optional().default([]),
  reporter: z.string().optional(),
  status: z
    .enum(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'])
    .optional()
    .default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  type: z
    .enum(['task', 'bug', 'revision', 'design', 'development', 'content', 'other'])
    .optional()
    .default('task'),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.number().min(0).optional().default(0),
  loggedHours: z.number().min(0).optional().default(0),
  labels: z.array(z.string()).optional().default([]),
  checklist: z
    .array(
      z.object({
        text: z.string(),
        done: z.boolean().optional().default(false),
      })
    )
    .optional()
    .default([]),
  parentTask: z.string().nullable().optional(),
  order: z.number().optional().default(0),
});

/**
 * List tasks with rich filters, search, and RBAC
 * GET /api/v1/tasks
 */
export const getTasks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      project,
      assignee,
      reporter,
      status,
      priority,
      type,
      search,
      dueDateFrom,
      dueDateTo,
      overdue,
      label,
    } = req.query;

    const query = { isDeleted: false };

    // RBAC: Check visibility
    const hasFullRead =
      req.permissions?.includes('*') || req.permissions?.includes('task.read');

    if (!hasFullRead && req.user?.employee) {
      // Find projects where user is manager or member
      const userProjects = await Project.find({
        isDeleted: false,
        $or: [
          { projectManager: req.user.employee },
          { 'members.employee': req.user.employee },
        ],
      }).select('_id');
      const projectIds = userProjects.map((p) => p._id);

      query.$or = [
        { assignees: req.user.employee },
        { reporter: req.user.employee },
        { project: { $in: projectIds } },
      ];
    }

    if (project) query.project = project;
    if (assignee) query.assignees = assignee;
    if (reporter) query.reporter = reporter;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    if (label) query.labels = label;

    if (overdue === 'true') {
      query.status = { $ne: 'done' };
      query.dueDate = { $lt: new Date() };
    } else {
      if (dueDateFrom || dueDateTo) {
        query.dueDate = {};
        if (dueDateFrom) query.dueDate.$gte = new Date(dueDateFrom);
        if (dueDateTo) query.dueDate.$lte = new Date(dueDateTo);
      }
    }

    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      const searchCondition = [
        { title: searchRegex },
        { taskCode: searchRegex },
        { description: searchRegex },
        { labels: searchRegex },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchCondition }];
        delete query.$or;
      } else {
        query.$or = searchCondition;
      }
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Task.countDocuments(query);

    const tasks = await Task.find(query)
      .populate('project', 'projectCode name client status')
      .populate('assignees', 'personal.firstName personal.lastName employment.designation personal.photo')
      .populate('reporter', 'personal.firstName personal.lastName personal.photo')
      .sort({ order: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    return sendSuccess(res, 'Tasks retrieved successfully', {
      tasks,
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
 * Get tasks assigned to logged in user grouped by status and due date
 * GET /api/v1/tasks/my
 */
export const getMyTasks = async (req, res, next) => {
  try {
    if (!req.user?.employee) {
      return sendSuccess(res, 'My tasks retrieved', {
        today: [],
        thisWeek: [],
        overdue: [],
        all: [],
        stats: { total: 0, completed: 0, pending: 0, overdue: 0 },
      });
    }

    const baseQuery = {
      assignees: req.user.employee,
      isDeleted: false,
    };

    const tasks = await Task.find(baseQuery)
      .populate('project', 'projectCode name client status')
      .populate('assignees', 'personal.firstName personal.lastName employment.designation personal.photo')
      .populate('reporter', 'personal.firstName personal.lastName personal.photo')
      .sort({ dueDate: 1, priority: -1 })
      .lean();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const todayTasks = [];
    const thisWeekTasks = [];
    const overdueTasks = [];

    tasks.forEach((t) => {
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        if (t.status !== 'done' && d < startOfToday) {
          overdueTasks.push(t);
        } else if (d >= startOfToday && d <= endOfToday) {
          todayTasks.push(t);
        } else if (d > endOfToday && d <= endOfWeek) {
          thisWeekTasks.push(t);
        }
      }
    });

    const completed = tasks.filter((t) => t.status === 'done').length;

    return sendSuccess(res, 'My tasks retrieved', {
      today: todayTasks,
      thisWeek: thisWeekTasks,
      overdue: overdueTasks,
      all: tasks,
      stats: {
        total: tasks.length,
        completed,
        pending: tasks.length - completed,
        overdue: overdueTasks.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get single task by ID with subtasks, comments, and activity
 * GET /api/v1/tasks/:id
 */
export const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isDeleted: false })
      .populate('project', 'projectCode name client status projectManager members')
      .populate('assignees', 'personal.firstName personal.lastName employment.designation personal.photo personal.officialEmail')
      .populate('reporter', 'personal.firstName personal.lastName employment.designation personal.photo personal.officialEmail')
      .lean();

    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    // Subtasks
    const subtasks = await Task.find({ parentTask: task._id, isDeleted: false })
      .populate('assignees', 'personal.firstName personal.lastName personal.photo')
      .lean();

    // Comments
    const comments = await TaskComment.find({ task: task._id })
      .populate({
        path: 'author',
        select: 'email employee',
        populate: {
          path: 'employee',
          select: 'personal.firstName personal.lastName personal.photo employment.designation',
        },
      })
      .sort({ createdAt: 1 })
      .lean();

    // Activities
    const activities = await TaskActivity.find({ task: task._id })
      .populate({
        path: 'actor',
        select: 'email employee',
        populate: {
          path: 'employee',
          select: 'personal.firstName personal.lastName personal.photo',
        },
      })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    return sendSuccess(res, 'Task retrieved successfully', {
      ...task,
      subtasks,
      comments,
      activities,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Create a new task
 * POST /api/v1/tasks
 */
export const createTask = async (req, res, next) => {
  try {
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    // Default reporter to logged in employee
    const reporter = parsed.data.reporter || req.user?.employee;
    if (!reporter) {
      return sendError(res, 'Reporter must be specified or user must have an associated employee record', 400);
    }

    // If order not set, set to highest order in the column + 1
    let order = parsed.data.order;
    if (!order) {
      const lastTask = await Task.findOne({
        project: parsed.data.project,
        status: parsed.data.status,
      }).sort({ order: -1 });
      order = lastTask ? (lastTask.order || 0) + 1 : 0;
    }

    const taskData = {
      ...parsed.data,
      reporter,
      order,
    };

    const task = await Task.create(taskData);

    // Update project progress
    await recalculateProjectProgress(task.project);

    // Log Activity
    await TaskActivity.create({
      task: task._id,
      actor: req.user?._id,
      action: 'CREATED',
      to: task.status,
    });

    // Notify assignees (if assignee is not the creator)
    if (Array.isArray(task.assignees)) {
      for (const assigneeId of task.assignees) {
        if (assigneeId.toString() !== req.user?.employee?.toString()) {
          await notifyEmployee(assigneeId, {
            title: `Assigned: ${task.taskCode}`,
            message: `You were assigned to task "${task.title}"`,
            link: `/projects/${task.project}?task=${task._id}`,
            type: 'task',
          });
        }
      }
    }

    return sendSuccess(res, 'Task created successfully', task, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update task
 * PUT /api/v1/tasks/:id
 */
export const updateTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    const canEdit = await canUserEditTask(task, req);
    if (!canEdit) {
      return sendError(res, 'You can only edit tasks assigned to you or in projects you manage', 403);
    }

    const parsed = taskSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation error', 400, parsed.error.format());
    }

    const oldStatus = task.status;
    const oldAssignees = task.assignees.map((a) => a.toString());

    Object.assign(task, parsed.data);

    if (parsed.data.status && parsed.data.status !== oldStatus) {
      if (parsed.data.status === 'done') {
        task.completedAt = new Date();
      } else {
        task.completedAt = null;
      }

      await TaskActivity.create({
        task: task._id,
        actor: req.user?._id,
        action: 'STATUS_CHANGE',
        from: oldStatus,
        to: parsed.data.status,
      });

      // If moved to in_review, notify reporter
      if (parsed.data.status === 'in_review' && task.reporter) {
        await notifyEmployee(task.reporter, {
          title: `Task Ready for Review: ${task.taskCode}`,
          message: `Task "${task.title}" was moved to In Review`,
          link: `/projects/${task.project}?task=${task._id}`,
          type: 'task',
        });
      }
    }

    await task.save();
    await recalculateProjectProgress(task.project);

    // Notify newly added assignees
    if (parsed.data.assignees) {
      const newAssignees = parsed.data.assignees.filter(
        (id) => !oldAssignees.includes(id.toString())
      );
      for (const newAssigneeId of newAssignees) {
        if (newAssigneeId.toString() !== req.user?.employee?.toString()) {
          await notifyEmployee(newAssigneeId, {
            title: `Assigned: ${task.taskCode}`,
            message: `You were assigned to task "${task.title}"`,
            link: `/projects/${task.project}?task=${task._id}`,
            type: 'task',
          });
        }
      }
    }

    return sendSuccess(res, 'Task updated successfully', task);
  } catch (err) {
    next(err);
  }
};

/**
 * Patch task status and order (Kanban card move)
 * PATCH /api/v1/tasks/:id/status
 */
export const patchTaskStatus = async (req, res, next) => {
  try {
    const { status, order } = req.body;
    if (!status || !['backlog', 'todo', 'in_progress', 'in_review', 'done', 'blocked'].includes(status)) {
      return sendError(res, 'Valid status is required', 400);
    }

    const task = await Task.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    const canEdit = await canUserEditTask(task, req);
    if (!canEdit) {
      return sendError(res, 'You can only edit tasks assigned to you or in projects you manage', 403);
    }

    const oldStatus = task.status;
    task.status = status;
    if (order !== undefined) {
      task.order = order;
    }

    if (status === 'done') {
      task.completedAt = new Date();
    } else {
      task.completedAt = null;
    }

    await task.save();
    await recalculateProjectProgress(task.project);

    // Log Activity
    if (oldStatus !== status) {
      await TaskActivity.create({
        task: task._id,
        actor: req.user?._id,
        action: 'STATUS_CHANGE',
        from: oldStatus,
        to: status,
      });

      // If moved to in_review, notify reporter
      if (status === 'in_review' && task.reporter) {
        await notifyEmployee(task.reporter, {
          title: `Task Ready for Review: ${task.taskCode}`,
          message: `Task "${task.title}" was moved to In Review`,
          link: `/projects/${task.project}?task=${task._id}`,
          type: 'task',
        });
      }
    }

    return sendSuccess(res, 'Task status updated', task);
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk reorder tasks (drag and drop across columns/within column)
 * POST /api/v1/tasks/reorder
 */
export const reorderTasks = async (req, res, next) => {
  try {
    const { tasks } = req.body; // array of { id, status, order }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return sendError(res, 'tasks array is required', 400);
    }

    // Authorization check: Verify user can edit tasks in all affected projects
    for (const item of tasks) {
      if (!item.id) continue;
      const t = await Task.findById(item.id);
      if (t) {
        const canEdit = await canUserEditTask(t, req);
        if (!canEdit) {
          return sendError(
            res,
            `Access denied. You do not have permission to reorder task [${t.taskCode || t.title}] in this project.`,
            403
          );
        }
      }
    }

    const impactedProjects = new Set();

    for (const item of tasks) {
      if (!item.id) continue;
      const t = await Task.findById(item.id);
      if (t) {
        impactedProjects.add(t.project.toString());
        const oldStatus = t.status;
        if (item.status && item.status !== t.status) {
          t.status = item.status;
          if (item.status === 'done') t.completedAt = new Date();
          else t.completedAt = null;

          await TaskActivity.create({
            task: t._id,
            actor: req.user?._id,
            action: 'STATUS_CHANGE',
            from: oldStatus,
            to: item.status,
          });
        }
        if (item.order !== undefined) {
          t.order = item.order;
        }
        await t.save();
      }
    }

    for (const pId of impactedProjects) {
      await recalculateProjectProgress(pId);
    }

    return sendSuccess(res, 'Tasks reordered successfully', { count: tasks.length });
  } catch (err) {
    next(err);
  }
};

/**
 * Bulk update tasks
 * POST /api/v1/tasks/bulk-update
 */
export const bulkUpdateTasks = async (req, res, next) => {
  try {
    const { taskIds, status, priority, assignee } = req.body;
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return sendError(res, 'taskIds array is required', 400);
    }

    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (status === 'done') updates.completedAt = new Date();

    const tasks = await Task.find({ _id: { $in: taskIds }, isDeleted: false });
    const impactedProjects = new Set();

    for (const t of tasks) {
      impactedProjects.add(t.project.toString());
      Object.assign(t, updates);
      if (assignee && !t.assignees.some((a) => a.toString() === assignee)) {
        t.assignees.push(assignee);
      }
      await t.save();
    }

    for (const pId of impactedProjects) {
      await recalculateProjectProgress(pId);
    }

    return sendSuccess(res, `${tasks.length} tasks updated`, { updatedCount: tasks.length });
  } catch (err) {
    next(err);
  }
};

/**
 * Soft delete task
 * DELETE /api/v1/tasks/:id
 */
export const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    const canEdit = await canUserEditTask(task, req);
    if (!canEdit) {
      return sendError(res, 'You can only edit tasks assigned to you or in projects you manage', 403);
    }

    task.isDeleted = true;
    await task.save();

    await recalculateProjectProgress(task.project);

    await logAudit({
      user: req.user?._id,
      action: 'TASK_DELETE',
      resource: 'Task',
      resourceId: task._id,
      details: { title: task.title, taskCode: task.taskCode },
    });

    return sendSuccess(res, 'Task deleted successfully', null);
  } catch (err) {
    next(err);
  }
};

/**
 * Add comment to task
 * POST /api/v1/tasks/:id/comments
 */
export const addTaskComment = async (req, res, next) => {
  try {
    const { body, mentions } = req.body;
    if (!body || !body.trim()) {
      return sendError(res, 'Comment body cannot be empty', 400);
    }

    const task = await Task.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    const canEdit = await canUserEditTask(task, req);
    if (!canEdit) {
      return sendError(res, 'You can only edit tasks assigned to you or in projects you manage', 403);
    }

    const comment = await TaskComment.create({
      task: task._id,
      author: req.user?._id,
      body: body.trim(),
      mentions: Array.isArray(mentions) ? mentions : [],
    });

    // Populate author
    await comment.populate({
      path: 'author',
      select: 'email employee',
      populate: {
        path: 'employee',
        select: 'personal.firstName personal.lastName personal.photo employment.designation',
      },
    });

    // Log Activity
    await TaskActivity.create({
      task: task._id,
      actor: req.user?._id,
      action: 'COMMENT_ADDED',
      to: body.substring(0, 80),
    });

    // Notify mentioned employees
    if (Array.isArray(mentions)) {
      for (const empId of mentions) {
        if (empId.toString() !== req.user?.employee?.toString()) {
          await notifyEmployee(empId, {
            title: `Mentioned in ${task.taskCode}`,
            message: `You were mentioned in a comment on "${task.title}": "${body.substring(0, 90)}..."`,
            link: `/projects/${task.project}?task=${task._id}`,
            type: 'mention',
          });
        }
      }
    }

    return sendSuccess(res, 'Comment added successfully', comment, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Get comments for a task
 * GET /api/v1/tasks/:id/comments
 */
export const getTaskComments = async (req, res, next) => {
  try {
    const comments = await TaskComment.find({ task: req.params.id })
      .populate({
        path: 'author',
        select: 'email employee',
        populate: {
          path: 'employee',
          select: 'personal.firstName personal.lastName personal.photo employment.designation',
        },
      })
      .sort({ createdAt: 1 })
      .lean();

    return sendSuccess(res, 'Comments retrieved', comments);
  } catch (err) {
    next(err);
  }
};

/**
 * Get task activity timeline
 * GET /api/v1/tasks/:id/activity
 */
export const getTaskActivity = async (req, res, next) => {
  try {
    const activities = await TaskActivity.find({ task: req.params.id })
      .populate({
        path: 'actor',
        select: 'email employee',
        populate: {
          path: 'employee',
          select: 'personal.firstName personal.lastName personal.photo',
        },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return sendSuccess(res, 'Task activity log retrieved', activities);
  } catch (err) {
    next(err);
  }
};

/**
 * Upload task attachment
 * POST /api/v1/tasks/:id/attachments
 */
export const uploadTaskAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, 'No file uploaded', 400);
    }

    const task = await Task.findOne({ _id: req.params.id, isDeleted: false });
    if (!task) {
      return sendError(res, 'Task not found', 404);
    }

    const canEdit = await canUserEditTask(task, req);
    if (!canEdit) {
      return sendError(res, 'You can only edit tasks assigned to you or in projects you manage', 403);
    }

    const attachment = {
      name: req.file.originalname || 'Attachment',
      url: req.file.path || req.file.secure_url,
      publicId: req.file.filename || req.file.public_id,
      size: req.file.size || 0,
      uploadedAt: new Date(),
    };

    task.attachments.push(attachment);
    await task.save();

    await TaskActivity.create({
      task: task._id,
      actor: req.user?._id,
      action: 'ATTACHMENT_ADDED',
      to: attachment.name,
    });

    return sendSuccess(res, 'Attachment uploaded successfully', attachment, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Update comment (author or admin only)
 * PUT /api/v1/tasks/:id/comments/:commentId
 */
export const updateTaskComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const { body } = req.body;
    if (!body || !body.trim()) {
      return sendError(res, 'Comment text cannot be empty', 400);
    }

    const comment = await TaskComment.findOne({ _id: commentId, task: id });
    if (!comment) {
      return sendError(res, 'Comment not found', 404);
    }

    const isAuthor = comment.author?.toString() === req.user?._id?.toString();
    const isAdmin =
      req.permissions?.includes('*') ||
      ['super_admin', 'admin'].includes(req.userRole) ||
      ['super_admin', 'admin'].includes(req.user?.role?.key);

    if (!isAuthor && !isAdmin) {
      return sendError(res, 'Only the author or administrators can edit this comment', 403);
    }

    comment.body = body.trim();
    comment.editedAt = new Date();
    await comment.save();

    return sendSuccess(res, 'Comment updated successfully', comment);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete comment (author or admin only)
 * DELETE /api/v1/tasks/:id/comments/:commentId
 */
export const deleteTaskComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const comment = await TaskComment.findOne({ _id: commentId, task: id });
    if (!comment) {
      return sendError(res, 'Comment not found', 404);
    }

    const isAuthor = comment.author?.toString() === req.user?._id?.toString();
    const isAdmin =
      req.permissions?.includes('*') ||
      ['super_admin', 'admin'].includes(req.userRole) ||
      ['super_admin', 'admin'].includes(req.user?.role?.key);

    if (!isAuthor && !isAdmin) {
      return sendError(res, 'Only the author or administrators can delete this comment', 403);
    }

    await comment.deleteOne();
    return sendSuccess(res, 'Comment deleted successfully', null);
  } catch (err) {
    next(err);
  }
};

