import mongoose from 'mongoose';
import { ReviewCycle } from '../models/ReviewCycle.js';
import { ReviewTemplate } from '../models/ReviewTemplate.js';
import { PerformanceReview } from '../models/PerformanceReview.js';
import { Goal } from '../models/Goal.js';
import { PeerFeedback } from '../models/PeerFeedback.js';
import { OneOnOne } from '../models/OneOnOne.js';
import { PerformanceFeedback } from '../models/PerformanceFeedback.js';
import { PerformanceSettings } from '../models/PerformanceSettings.js';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logAudit } from '../middleware/audit.js';
import * as perfService from '../services/performance.service.js';

/**
 * 1. GET /api/v1/performance/summary
 * Studio overview metrics, active cycles, and privacy-protected department charts (minGroupSize >= 3)
 */
export const getPerformanceSummary = async (req, res, next) => {
  try {
    const userRole = req.userRole;
    const employeeId = req.user?.employee?._id || req.user?.employee;
    const settings = await perfService.getPerformanceSettings();

    const activeCycle = await ReviewCycle.findOne({ status: { $in: ['active', 'in_review', 'calibration'] } })
      .populate('template', 'name code')
      .sort({ periodStart: -1 });

    const totalCycles = await ReviewCycle.countDocuments();
    const myGoalsCount = employeeId ? await Goal.countDocuments({ employee: employeeId, status: 'active' }) : 0;

    let reviewStats = { total: 0, selfDone: 0, managerDone: 0, calibrated: 0, published: 0 };
    if (activeCycle) {
      const allReviews = await PerformanceReview.find({ cycle: activeCycle._id });
      reviewStats.total = allReviews.length;
      reviewStats.selfDone = allReviews.filter((r) => r.selfReview?.submittedAt).length;
      reviewStats.managerDone = allReviews.filter((r) => r.managerReview?.submittedAt).length;
      reviewStats.calibrated = allReviews.filter((r) => r.calibration?.calibratedAt).length;
      reviewStats.published = allReviews.filter((r) => r.isPublished).length;
    }

    // Privacy-protected department distribution (shown only to HR/Admin, minGroupSize >= 3)
    let departmentAverages = [];
    if (['super_admin', 'admin', 'hr'].includes(userRole) && activeCycle) {
      const reviews = await PerformanceReview.find({ cycle: activeCycle._id, 'managerReview.finalOverallRating': { $gt: 0 } })
        .populate({ path: 'employee', populate: { path: 'employment.department' } });

      const deptMap = {};
      reviews.forEach((r) => {
        const dept = r.employee?.employment?.department?.name || 'Unassigned';
        if (!deptMap[dept]) deptMap[dept] = { count: 0, totalRating: 0 };
        deptMap[dept].count += 1;
        deptMap[dept].totalRating += r.managerReview.finalOverallRating;
      });

      // Filter: Strictly hide groups under 3 people to preserve privacy!
      const minGroup = settings.minGroupSizeForCharts || 3;
      Object.keys(deptMap).forEach((dept) => {
        if (deptMap[dept].count >= minGroup) {
          departmentAverages.push({
            department: dept,
            employeeCount: deptMap[dept].count,
            averageRating: Number((deptMap[dept].totalRating / deptMap[dept].count).toFixed(2)),
          });
        }
      });
    }

    return sendSuccess(
      res,
      {
        activeCycle,
        totalCycles,
        myGoalsCount,
        reviewStats,
        departmentAverages,
        noticeText: settings.noticeText,
        isPolicyConfirmed: settings.policyConfirmed,
      },
      'Performance overview retrieved successfully'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2. GET /api/v1/performance/cycles
 */
export const listCycles = async (req, res, next) => {
  try {
    const cycles = await ReviewCycle.find()
      .populate('template', 'name code')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return sendSuccess(res, cycles, 'Review cycles retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 3. POST /api/v1/performance/cycles
 */
export const createCycle = async (req, res, next) => {
  try {
    const cycle = await perfService.createCycle({
      data: req.body,
      user: req.user,
      req,
    });
    return sendSuccess(res, cycle, 'Review cycle created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 4. POST /api/v1/performance/cycles/:id/start
 */
export const startCycle = async (req, res, next) => {
  try {
    const cycle = await perfService.startCycle({
      cycleId: req.params.id,
      user: req.user,
      req,
    });
    return sendSuccess(res, cycle, `Review cycle '${cycle.name}' has been started`);
  } catch (err) {
    next(err);
  }
};

/**
 * 5. POST /api/v1/performance/cycles/:id/publish
 */
export const publishCycle = async (req, res, next) => {
  try {
    const cycle = await ReviewCycle.findById(req.params.id);
    if (!cycle) return sendError(res, 'Cycle not found', 404);

    const reviews = await PerformanceReview.find({ cycle: cycle._id });
    for (const r of reviews) {
      if (!r.isPublished) {
        await perfService.publishReview({ reviewId: r._id, user: req.user, req });
      }
    }

    cycle.status = 'published';
    await cycle.save();

    return sendSuccess(res, cycle, `Cycle '${cycle.name}' outcomes published to employees`);
  } catch (err) {
    next(err);
  }
};

/**
 * 6. POST /api/v1/performance/cycles/:id/close
 */
export const closeCycle = async (req, res, next) => {
  try {
    const cycle = await ReviewCycle.findByIdAndUpdate(
      req.params.id,
      { status: 'closed' },
      { new: true }
    );
    return sendSuccess(res, cycle, 'Review cycle closed');
  } catch (err) {
    next(err);
  }
};

/**
 * 7. GET /api/v1/performance/templates
 */
export const listTemplates = async (req, res, next) => {
  try {
    // Seed defaults if empty
    const count = await ReviewTemplate.countDocuments();
    if (count === 0) {
      const { seedPerformanceDefaults } = await import('../services/performanceSeed.service.js');
      await seedPerformanceDefaults();
    }

    const templates = await ReviewTemplate.find().sort({ createdAt: -1 });
    return sendSuccess(res, templates, 'Review templates retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 8. POST /api/v1/performance/templates
 */
export const createTemplate = async (req, res, next) => {
  try {
    const template = await ReviewTemplate.create({
      ...req.body,
      createdBy: req.user._id,
      unverified: true, // "unverified, confirm with HR"
    });
    return sendSuccess(res, template, 'Review template created', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 9. GET /api/v1/performance/goals
 */
export const listGoals = async (req, res, next) => {
  try {
    const userRole = req.userRole;
    const employeeId = req.user?.employee?._id || req.user?.employee;
    const query = {};

    if (userRole === 'employee') {
      query.$or = [{ employee: employeeId }, { visibility: 'company' }];
    } else if (['project_manager', 'manager'].includes(userRole)) {
      query.$or = [{ employee: employeeId }, { visibility: { $in: ['team', 'company'] } }];
    }

    const goals = await Goal.find(query)
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation')
      .populate('linkedProjects', 'name code')
      .sort({ createdAt: -1 });

    return sendSuccess(res, goals, 'Goals retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 10. POST /api/v1/performance/goals
 */
export const createGoal = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee?._id || req.user?.employee;
    if (!employeeId) return sendError(res, 'No linked employee profile', 400);

    const settings = await perfService.getPerformanceSettings();
    const status = settings.goalApprovalRequired ? 'pending_approval' : 'active';

    const goal = new Goal({
      ...req.body,
      employee: employeeId,
      status,
    });
    goal.recalculateProgress();
    await goal.save();

    if (settings.goalApprovalRequired) {
      // Find manager
      const emp = await Employee.findById(employeeId);
      const manager = await perfService.resolveReviewManager(emp);

      const approval = await ApprovalRequest.create({
        type: 'goal',
        referenceModel: 'Goal',
        referenceId: goal._id,
        requestedBy: req.user._id,
        currentStep: 1,
        steps: [
          {
            order: 1,
            title: 'Manager Goal Review',
            approverRole: 'manager',
            approverEmployee: manager?._id || null,
            status: 'pending',
          },
        ],
        metadata: {
          title: goal.title,
          keyResultCount: goal.keyResults?.length || 0,
          weight: goal.weight,
        },
      });

      goal.approvalRequest = approval._id;
      await goal.save();
    }

    return sendSuccess(res, goal, 'Goal created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 11. POST /api/v1/performance/goals/:id/updates
 */
export const addGoalProgressUpdate = async (req, res, next) => {
  try {
    const goal = await Goal.findById(req.params.id);
    if (!goal) return sendError(res, 'Goal not found', 404);

    const { keyResultIndex, currentValue, note } = req.body;
    if (keyResultIndex !== undefined && goal.keyResults[keyResultIndex]) {
      goal.keyResults[keyResultIndex].currentValue = Number(currentValue);
    }

    goal.progressUpdates.push({
      date: new Date(),
      value: Number(currentValue),
      note: note || '',
      updatedBy: req.user._id,
    });

    goal.recalculateProgress();
    await goal.save();

    return sendSuccess(res, goal, 'Goal progress recorded');
  } catch (err) {
    next(err);
  }
};

/**
 * 12. GET /api/v1/performance/reviews
 */
export const listReviews = async (req, res, next) => {
  try {
    const userRole = req.userRole;
    const employeeId = req.user?.employee?._id || req.user?.employee;
    const cycleId = req.query.cycleId || null;

    const reviews = await perfService.getScopedReviews({
      user: req.user,
      userRole,
      employeeId,
      cycleId,
    });

    // Audit log access to evaluation records
    await logAudit({
      req,
      action: 'VIEW_PERFORMANCE_REVIEWS',
      entity: 'PerformanceReview',
      changes: { userRole, count: reviews.length },
    });

    return sendSuccess(res, reviews.filter(Boolean), 'Reviews retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 13. GET /api/v1/performance/reviews/:id
 */
export const getReviewById = async (req, res, next) => {
  try {
    const review = await PerformanceReview.findById(req.params.id)
      .populate('cycle')
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation employment.department')
      .populate('manager', 'personal.firstName personal.lastName employeeId');

    if (!review) return sendError(res, 'Review not found', 404);

    const sanitized = perfService.sanitizeReviewForUser(
      review,
      req.user,
      req.userRole,
      req.user?.employee?._id || req.user?.employee
    );

    if (!sanitized) return sendError(res, 'Access denied', 403);

    return sendSuccess(res, sanitized, 'Review details retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 14. POST /api/v1/performance/reviews/:id/self
 */
export const submitSelfReview = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee?._id || req.user?.employee;
    const review = await perfService.submitSelfReview({
      reviewId: req.params.id,
      data: req.body,
      employeeId,
      req,
    });
    return sendSuccess(res, review, 'Self-review submitted successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 15. POST /api/v1/performance/reviews/:id/manager
 */
export const submitManagerReview = async (req, res, next) => {
  try {
    const managerEmployeeId = req.user?.employee?._id || req.user?.employee;
    const review = await perfService.submitManagerReview({
      reviewId: req.params.id,
      data: req.body,
      managerEmployeeId,
      userRole: req.userRole,
      req,
    });
    return sendSuccess(res, review, 'Manager review evaluation submitted');
  } catch (err) {
    next(err);
  }
};

/**
 * 16. POST /api/v1/performance/reviews/:id/calibrate
 */
export const calibrateReview = async (req, res, next) => {
  try {
    const { calibratedRating, reason } = req.body;
    const review = await perfService.calibrateReview({
      reviewId: req.params.id,
      calibratedRating,
      reason,
      user: req.user,
      req,
    });
    return sendSuccess(res, review, 'Performance rating calibrated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * 17. POST /api/v1/performance/reviews/:id/publish
 */
export const publishSingleReview = async (req, res, next) => {
  try {
    const review = await perfService.publishReview({
      reviewId: req.params.id,
      user: req.user,
      req,
    });
    return sendSuccess(res, review, 'Performance review published to employee');
  } catch (err) {
    next(err);
  }
};

/**
 * 18. POST /api/v1/performance/reviews/:id/acknowledge
 */
export const acknowledgeReview = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee?._id || req.user?.employee;
    const { comments, isDisputed, meetingRequested } = req.body;
    const review = await perfService.acknowledgeReview({
      reviewId: req.params.id,
      comments,
      isDisputed,
      meetingRequested,
      employeeId,
      req,
    });
    return sendSuccess(res, review, 'Review acknowledgement recorded');
  } catch (err) {
    next(err);
  }
};

/**
 * 19. POST /api/v1/performance/reviews/:id/update-rating
 */
export const updateRatingPostPublish = async (req, res, next) => {
  try {
    const { newRating, reason } = req.body;
    const review = await perfService.updateRatingPostPublish({
      reviewId: req.params.id,
      newRating,
      reason,
      user: req.user,
      req,
    });
    return sendSuccess(res, review, 'Published rating updated and logged');
  } catch (err) {
    next(err);
  }
};

/**
 * 20. POST /api/v1/performance/reviews/:id/recommend-pip
 */
export const recommendDraftPIP = async (req, res, next) => {
  try {
    const draftPip = await perfService.createDraftPIPFromReview({
      reviewId: req.params.id,
      user: req.user,
      req,
    });
    return sendSuccess(res, draftPip, 'Draft PIP created in Warnings & PIP (draft only, not started)', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 21. GET /api/v1/performance/reviews/:id/work-context
 */
export const getReviewWorkContext = async (req, res, next) => {
  try {
    const review = await PerformanceReview.findById(req.params.id).populate('cycle');
    if (!review) return sendError(res, 'Review not found', 404);

    const context = await perfService.getReviewWorkContext(
      review.employee,
      review.cycle?.periodStart,
      review.cycle?.periodEnd
    );

    return sendSuccess(res, context, 'Read-only work activity context retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * 22. 360 Feedback Endpoints
 */
export const nominatePeer = async (req, res, next) => {
  try {
    const { reviewId, peerEmployeeId, isAnonymous } = req.body;
    const review = await PerformanceReview.findById(reviewId);
    if (!review) return sendError(res, 'Review not found', 404);

    const feedback = await PeerFeedback.create({
      review: review._id,
      cycle: review.cycle,
      employee: review.employee,
      peer: peerEmployeeId,
      isAnonymous: isAnonymous !== undefined ? isAnonymous : true,
      status: 'nominated',
    });

    return sendSuccess(res, feedback, 'Peer nominated for 360 review', 201);
  } catch (err) {
    next(err);
  }
};

export const submitPeerFeedback = async (req, res, next) => {
  try {
    const peerEmployeeId = req.user?.employee?._id || req.user?.employee;
    const { feedbackId, responses } = req.body;

    const feedback = await PeerFeedback.findById(feedbackId);
    if (!feedback) return sendError(res, 'Peer feedback requisition not found', 404);
    if (String(feedback.peer) !== String(peerEmployeeId)) {
      return sendError(res, 'Access denied: You are not the assigned peer reviewer', 403);
    }

    feedback.responses = responses || [];
    feedback.status = 'submitted';
    feedback.submittedAt = new Date();
    await feedback.save();

    return sendSuccess(res, feedback, '360 peer feedback submitted');
  } catch (err) {
    next(err);
  }
};

/**
 * 23. One-on-Ones Endpoints
 */
export const listOneOnOnes = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee?._id || req.user?.employee;
    const meetings = await OneOnOne.find({
      $or: [{ employee: employeeId }, { manager: employeeId }],
    })
      .populate('employee', 'personal.firstName personal.lastName employeeId')
      .populate('manager', 'personal.firstName personal.lastName employeeId')
      .sort({ meetingDate: -1 });

    // Scoping private notes: employee only sees privateNotesEmployee; manager sees privateNotesManager
    const sanitized = meetings.map((m) => {
      const obj = m.toObject();
      if (String(obj.employee?._id) === String(employeeId)) {
        delete obj.privateNotesManager;
      } else if (String(obj.manager?._id) === String(employeeId)) {
        delete obj.privateNotesEmployee;
      }
      return obj;
    });

    return sendSuccess(res, sanitized, '1:1 meetings retrieved');
  } catch (err) {
    next(err);
  }
};

export const createOneOnOne = async (req, res, next) => {
  try {
    const meeting = await OneOnOne.create(req.body);
    return sendSuccess(res, meeting, '1:1 meeting scheduled', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 24. Performance Feedback (Kudos / Constructive)
 */
export const listFeedback = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee?._id || req.user?.employee;
    const feedbackList = await PerformanceFeedback.find({
      $or: [
        { visibility: 'public' },
        { toEmployee: employeeId },
        { fromEmployee: employeeId },
      ],
      isReported: false,
    })
      .populate('fromEmployee', 'personal.firstName personal.lastName employeeId')
      .populate('toEmployee', 'personal.firstName personal.lastName employeeId')
      .sort({ createdAt: -1 });

    return sendSuccess(res, feedbackList, 'Continuous feedback retrieved');
  } catch (err) {
    next(err);
  }
};

export const giveFeedback = async (req, res, next) => {
  try {
    const fromEmployeeId = req.user?.employee?._id || req.user?.employee;
    if (!fromEmployeeId) return sendError(res, 'No linked employee profile', 400);

    const feedback = await PerformanceFeedback.create({
      ...req.body,
      fromEmployee: fromEmployeeId,
    });

    return sendSuccess(res, feedback, 'Feedback shared successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * 25. Settings Endpoints
 */
export const getSettings = async (req, res, next) => {
  try {
    const settings = await perfService.getPerformanceSettings();
    return sendSuccess(res, settings, 'Performance settings retrieved');
  } catch (err) {
    next(err);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    let settings = await perfService.getPerformanceSettings();
    Object.assign(settings, req.body);
    await settings.save();

    await logAudit({
      req,
      action: 'UPDATE_PERFORMANCE_SETTINGS',
      entity: 'PerformanceSettings',
      changes: req.body,
    });

    return sendSuccess(res, settings, 'Performance settings updated');
  } catch (err) {
    next(err);
  }
};

/**
 * 26. GET /api/v1/performance/export
 * Export with watermark and audit logging
 */
export const exportPerformanceData = async (req, res, next) => {
  try {
    const { cycleId } = req.query;
    const query = cycleId ? { cycle: cycleId } : {};

    const reviews = await PerformanceReview.find(query)
      .populate('cycle', 'name periodStart periodEnd')
      .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation employment.department')
      .populate('manager', 'personal.firstName personal.lastName employeeId');

    const watermark = `CONFIDENTIAL - Illusory Design Studios - Exported by ${req.user.email} on ${new Date().toISOString()}`;

    await logAudit({
      req,
      action: 'EXPORT_PERFORMANCE_DATA',
      entity: 'PerformanceReview',
      changes: { watermark, recordCount: reviews.length, cycleId },
    });

    return sendSuccess(
      res,
      {
        watermark,
        records: reviews,
      },
      'Performance evaluation data exported with audit watermark'
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 27. GET /api/v1/me/performance
 * Dashboard overview for the logged-in user
 */
export const getMyPerformance = async (req, res, next) => {
  try {
    const employeeId = req.user?.employee?._id || req.user?.employee;
    if (!employeeId) return sendError(res, 'No linked employee profile', 400);

    const activeCycle = await ReviewCycle.findOne({ status: { $in: ['active', 'in_review', 'calibration', 'published'] } })
      .populate('template', 'name ratingScale sections')
      .sort({ periodStart: -1 });

    const review = activeCycle
      ? await PerformanceReview.findOne({ cycle: activeCycle._id, employee: employeeId })
          .populate('manager', 'personal.firstName personal.lastName employeeId')
      : null;

    const myGoals = await Goal.find({ employee: employeeId }).sort({ dueDate: 1 });
    const oneOnOnes = await OneOnOne.find({ employee: employeeId, status: 'scheduled' }).sort({ meetingDate: 1 }).limit(3);

    return sendSuccess(
      res,
      {
        activeCycle,
        review: review ? perfService.sanitizeReviewForUser(review, req.user, req.userRole, employeeId) : null,
        myGoals,
        upcomingOneOnOnes: oneOnOnes,
      },
      'My performance data retrieved'
    );
  } catch (err) {
    next(err);
  }
};
