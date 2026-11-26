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
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { Warning } from '../models/Warning.js';
import { ApprovalRequest } from '../models/ApprovalRequest.js';
import Task from '../models/Task.js';
import TimeEntry from '../models/TimeEntry.js';
import { logAudit } from '../middleware/audit.js';
import { notifyUser } from './notification.service.js';

/**
 * Fetch or initialize global Performance Settings
 */
export const getPerformanceSettings = async () => {
  let settings = await PerformanceSettings.findOne();
  if (!settings) {
    const { seedPerformanceDefaults } = await import('./performanceSeed.service.js');
    const seeded = await seedPerformanceDefaults();
    settings = seeded.settings;
  }
  return settings;
};

/**
 * Resolve manager for an employee adhering to conflict rules:
 * 1. Nobody reviews themselves as the manager step.
 * 2. HR's reviews route to a Super Admin.
 * 3. If employee has no manager or is CEO, route to Super Admin.
 */
export const resolveReviewManager = async (employee) => {
  const hrRole = await Role.findOne({ key: 'hr' });
  const superAdminRole = await Role.findOne({ key: 'super_admin' });

  // Resolve department name if populated or ID
  let deptName = employee.employment?.department?.name;
  if (!deptName && employee.employment?.department) {
    const dept = await Department.findById(employee.employment.department);
    deptName = dept?.name;
  }

  // Check if employee is in HR department or holds HR role
  const isHR = deptName === 'Human Resources' ||
    (employee.user && employee.user.role && String(employee.user.role) === String(hrRole?._id));

  if (isHR) {
    // Find a Super Admin employee
    const superAdminUser = await User.findOne({ role: superAdminRole?._id }).populate('employee');
    if (superAdminUser?.employee && String(superAdminUser.employee._id) !== String(employee._id)) {
      return superAdminUser.employee;
    }
  }

  // Check direct reporting manager (strictly block self-review as manager)
  const managerId = employee.employment?.reportingManager;
  if (managerId && String(managerId) !== String(employee._id)) {
    const mgr = await Employee.findById(managerId);
    if (mgr) return mgr;
  }

  // Fallback: Assign CEO or Super Admin
  const adminUser = await User.findOne({ role: superAdminRole?._id }).populate('employee');
  return adminUser?.employee || null;
};

/**
 * Calculate suggested overall rating from section weights
 */
export const calculateSuggestedRating = (sectionResponses, template) => {
  if (!sectionResponses || sectionResponses.length === 0 || !template?.sections) {
    return 0;
  }

  let totalWeight = 0;
  let weightedScore = 0;

  for (const resp of sectionResponses) {
    const section = template.sections.find((s) => s.key === resp.sectionKey);
    const weight = section?.weight || 0;
    const rating = Number(resp.rating) || 0;

    if (rating > 0 && weight > 0) {
      weightedScore += rating * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return 0;
  return Number((weightedScore / totalWeight).toFixed(2));
};

/**
 * 1. Create a Review Cycle (with template snapshot and optional probation drafts)
 */
export const createCycle = async ({ data, user, req }) => {
  const template = await ReviewTemplate.findById(data.template);
  if (!template) {
    throw new Error('Review template not found');
  }

  const cycle = await ReviewCycle.create({
    ...data,
    templateSnapshot: template.toObject(),
    createdBy: user._id,
  });

  // If autoDraftProbation is enabled, draft reviews for probationers ending within probationDaysLead
  if (cycle.autoDraftProbation) {
    await draftProbationReviews({ cycle, template, user });
  }

  await logAudit({
    req,
    action: 'CREATE_REVIEW_CYCLE',
    entity: 'ReviewCycle',
    entityId: cycle._id,
    changes: { name: cycle.name, type: cycle.type, status: cycle.status },
  });

  return cycle;
};

/**
 * Auto-draft probation reviews for probationers ending within N days
 */
export const draftProbationReviews = async ({ cycle, template, user }) => {
  const leadDays = cycle.probationDaysLead || 15;
  const now = new Date();
  const futureThreshold = new Date();
  futureThreshold.setDate(now.getDate() + leadDays);

  const probationers = await Employee.find({
    status: 'probation',
    'employment.probationEndDate': { $lte: futureThreshold },
  });

  for (const emp of probationers) {
    const existing = await PerformanceReview.findOne({ cycle: cycle._id, employee: emp._id });
    if (!existing) {
      const manager = await resolveReviewManager(emp);
      if (manager) {
        await PerformanceReview.create({
          cycle: cycle._id,
          employee: emp._id,
          manager: manager._id,
          status: 'goals_confirmed',
        });
      }
    }
  }
};

/**
 * 2. Start Review Cycle (Draft -> Active)
 * Generates PerformanceReview records for all scoped participants
 */
export const startCycle = async ({ cycleId, user, req }) => {
  const cycle = await ReviewCycle.findById(cycleId).populate('template');
  if (!cycle) throw new Error('Review cycle not found');
  if (cycle.status !== 'draft') throw new Error(`Cannot start cycle in '${cycle.status}' status`);

  let employees = [];

  if (cycle.participantsScope === 'all') {
    employees = await Employee.find({ status: { $in: ['active', 'probation'] } });
  } else if (cycle.participantsScope === 'department') {
    employees = await Employee.find({
      'employment.department': { $in: cycle.participantDepartments },
      status: { $in: ['active', 'probation'] },
    });
  } else if (cycle.participantsScope === 'selected') {
    employees = await Employee.find({ _id: { $in: cycle.participantEmployees } });
  } else if (cycle.participantsScope === 'probation_ending') {
    employees = await Employee.find({ status: 'probation' });
  }

  for (const emp of employees) {
    const existing = await PerformanceReview.findOne({ cycle: cycle._id, employee: emp._id });
    if (!existing) {
      const manager = await resolveReviewManager(emp);
      if (manager) {
        await PerformanceReview.create({
          cycle: cycle._id,
          employee: emp._id,
          manager: manager._id,
          status: 'self_review_pending',
        });

        // Notify employee (NO ratings in notification!)
        if (emp.user) {
          await notifyUser({
            userId: emp.user,
            title: `Review Cycle Started: ${cycle.name}`,
            message: `A new performance review cycle has begun. Please submit your self-review before the deadline.`,
            link: `/hrms/performance`,
            type: 'system',
          });
        }
      }
    }
  }

  cycle.status = 'active';
  await cycle.save();

  await logAudit({
    req,
    action: 'START_REVIEW_CYCLE',
    entity: 'ReviewCycle',
    entityId: cycle._id,
    changes: { status: 'active', participantCount: employees.length },
  });

  return cycle;
};

/**
 * 3. Submit Self Review
 */
export const submitSelfReview = async ({ reviewId, data, employeeId, req }) => {
  const review = await PerformanceReview.findById(reviewId)
    .populate('cycle')
    .populate('employee')
    .populate('manager');

  if (!review) throw new Error('Review record not found');
  if (String(review.employee._id) !== String(employeeId)) {
    throw new Error('Access denied: You can only submit your own self-review');
  }

  review.selfReview = {
    submittedAt: new Date(),
    sectionResponses: data.sectionResponses || [],
    overallComment: data.overallComment || '',
  };
  review.status = 'self_review_submitted';
  await review.save();

  // Notify manager that self review is ready
  if (review.manager?.user) {
    await notifyUser({
      userId: review.manager.user,
      title: `Self-Review Submitted by ${review.employee.personal?.firstName}`,
      message: `A review needs your attention: Self-evaluation completed for ${review.cycle?.name}.`,
      link: `/hrms/performance`,
      type: 'system',
    });
  }

  await logAudit({
    req,
    action: 'SUBMIT_SELF_REVIEW',
    entity: 'PerformanceReview',
    entityId: review._id,
    changes: { status: review.status },
  });

  return review;
};

/**
 * 4. Submit Manager Review
 */
export const submitManagerReview = async ({ reviewId, data, managerEmployeeId, userRole, req }) => {
  const review = await PerformanceReview.findById(reviewId)
    .populate('cycle')
    .populate('employee')
    .populate('manager');

  if (!review) throw new Error('Review record not found');

  const isAssignedManager = String(review.manager._id) === String(managerEmployeeId);
  const isHRorAdmin = ['super_admin', 'admin', 'hr'].includes(userRole);

  if (!isAssignedManager && !isHRorAdmin) {
    throw new Error('Access denied: Only the assigned manager or HR can submit this review');
  }

  // Calculate suggested overall rating
  const template = review.cycle?.templateSnapshot || review.cycle?.template;
  const suggestedRating = calculateSuggestedRating(data.sectionResponses, template);

  const finalRating = Number(data.finalOverallRating);
  if (!finalRating || finalRating < 1 || finalRating > 5) {
    throw new Error('Final overall rating must be an integer or decimal between 1 and 5');
  }

  // If final rating differs from calculated suggestion, reason is mandatory!
  if (suggestedRating > 0 && Math.abs(finalRating - suggestedRating) >= 0.5 && !data.ratingDiffReason?.trim()) {
    throw new Error('A detailed reason is required whenever the final rating differs from the calculated suggestion');
  }

  // Extreme rating check (1 or 5)
  if ((finalRating === 1 || finalRating === 5) && !data.ratingDiffReason?.trim() && !data.recommendationNotes?.trim()) {
    throw new Error('A comprehensive justification is required for ratings of 1 or 5');
  }

  review.managerReview = {
    submittedAt: new Date(),
    sectionResponses: data.sectionResponses || [],
    strengths: data.strengths || '',
    areasToImprove: data.areasToImprove || '',
    developmentPlan: data.developmentPlan || '',
    recommendationNotes: data.recommendationNotes || '',
    recommendPIP: !!data.recommendPIP,
    recommendPromotion: !!data.recommendPromotion,
    recommendIncrement: !!data.recommendIncrement,
    recommendedRating: suggestedRating,
    finalOverallRating: finalRating,
    ratingDiffReason: data.ratingDiffReason || '',
  };

  review.status = 'manager_review_submitted';
  await review.save();

  await logAudit({
    req,
    action: 'SUBMIT_MANAGER_REVIEW',
    entity: 'PerformanceReview',
    entityId: review._id,
    changes: {
      finalOverallRating: finalRating,
      suggestedRating,
      recommendPIP: !!data.recommendPIP,
    },
  });

  return review;
};

/**
 * 5. Calibrate Review (HR & Super Admin)
 */
export const calibrateReview = async ({ reviewId, calibratedRating, reason, user, req }) => {
  if (!reason || !reason.trim()) {
    throw new Error('A mandatory recorded reason is required for any calibration change');
  }

  const review = await PerformanceReview.findById(reviewId);
  if (!review) throw new Error('Review not found');

  const prevRating = review.managerReview?.finalOverallRating || 0;
  review.calibration = {
    calibratedAt: new Date(),
    calibratedBy: user._id,
    previousRating: prevRating,
    calibratedRating: Number(calibratedRating),
    calibrationReason: reason.trim(),
  };

  // Update overall rating to calibrated rating
  review.managerReview.finalOverallRating = Number(calibratedRating);
  review.status = 'calibration';
  await review.save();

  await logAudit({
    req,
    action: 'CALIBRATE_PERFORMANCE_REVIEW',
    entity: 'PerformanceReview',
    entityId: review._id,
    changes: {
      previousRating: prevRating,
      calibratedRating: Number(calibratedRating),
      reason: reason.trim(),
    },
  });

  return review;
};

/**
 * 6. Publish Review Cycle / Single Review
 */
export const publishReview = async ({ reviewId, user, req }) => {
  const review = await PerformanceReview.findById(reviewId)
    .populate('cycle')
    .populate('employee');

  if (!review) throw new Error('Review not found');

  review.isPublished = true;
  review.publishedAt = new Date();
  review.publishedBy = user._id;
  review.status = 'published';
  await review.save();

  // Notify employee (NO ratings in notification!)
  if (review.employee?.user) {
    await notifyUser({
      userId: review.employee.user,
      title: `Performance Review Published: ${review.cycle?.name}`,
      message: `Your performance review outcome is now available for review and acknowledgement.`,
      link: `/hrms/performance`,
      type: 'system',
    });
  }

  await logAudit({
    req,
    action: 'PUBLISH_PERFORMANCE_REVIEW',
    entity: 'PerformanceReview',
    entityId: review._id,
    changes: { isPublished: true, publishedAt: review.publishedAt },
  });

  return review;
};

/**
 * 7. Employee Acknowledges Review
 * "Acknowledgement means received, not agreed"
 */
export const acknowledgeReview = async ({ reviewId, comments, isDisputed, meetingRequested, employeeId, req }) => {
  const review = await PerformanceReview.findById(reviewId).populate('employee');
  if (!review) throw new Error('Review not found');

  if (String(review.employee._id) !== String(employeeId)) {
    throw new Error('Access denied: You can only acknowledge your own review');
  }

  review.employeeAcknowledgement = {
    acknowledgedAt: new Date(),
    comments: comments || '',
    isDisputed: !!isDisputed,
    meetingRequested: !!meetingRequested,
  };

  review.status = isDisputed ? 'disputed' : 'acknowledged';
  await review.save();

  if (isDisputed) {
    // Notify HR team of dispute
    const hrUsers = await User.find().populate({
      path: 'role',
      match: { key: { $in: ['hr', 'super_admin'] } },
    });
    for (const hr of hrUsers) {
      if (hr.role) {
        await notifyUser({
          userId: hr._id,
          title: `Review Disputed: ${review.employee.personal?.firstName} ${review.employee.personal?.lastName}`,
          message: `An employee has submitted a formal response/disagreement for their published review.`,
          link: `/hrms/performance`,
          type: 'system',
        });
      }
    }
  }

  await logAudit({
    req,
    action: 'ACKNOWLEDGE_PERFORMANCE_REVIEW',
    entity: 'PerformanceReview',
    entityId: review._id,
    changes: { isDisputed: !!isDisputed, meetingRequested: !!meetingRequested },
  });

  return review;
};

/**
 * 8. Post-Publish Rating Change
 * Requires mandatory reason, audit logged, and notifies employee
 */
export const updateRatingPostPublish = async ({ reviewId, newRating, reason, user, req }) => {
  if (!reason || !reason.trim()) {
    throw new Error('A mandatory recorded reason is required for any post-publish rating alteration');
  }

  const review = await PerformanceReview.findById(reviewId).populate('employee');
  if (!review) throw new Error('Review not found');
  if (!review.isPublished) throw new Error('Review has not been published yet');

  const oldRating = review.managerReview?.finalOverallRating;
  review.postPublishRatingChanges.push({
    changedAt: new Date(),
    changedBy: user._id,
    oldRating,
    newRating: Number(newRating),
    reason: reason.trim(),
  });

  review.managerReview.finalOverallRating = Number(newRating);
  await review.save();

  // Notify employee of revision (NO rating numbers in notification)
  if (review.employee?.user) {
    await notifyUser({
      userId: review.employee.user,
      title: 'Performance Review Updated',
      message: 'Your published performance review has been adjusted by HR. Please view the updated record in ERP.',
      link: `/hrms/performance`,
      type: 'system',
    });
  }

  await logAudit({
    req,
    action: 'UPDATE_PUBLISHED_RATING',
    entity: 'PerformanceReview',
    entityId: review._id,
    changes: { oldRating, newRating: Number(newRating), reason: reason.trim() },
  });

  return review;
};

/**
 * 9. Recommend PIP (Creates Draft PIP in Warnings & PIP module)
 * "Creates a DRAFT PIP prefilled with the goals and review evidence. Nothing starts automatically."
 */
export const createDraftPIPFromReview = async ({ reviewId, user, req }) => {
  const review = await PerformanceReview.findById(reviewId)
    .populate('employee')
    .populate('cycle');

  if (!review) throw new Error('Review not found');

  const improvementPlanText = `
Recommended Action Plan from Performance Evaluation (${review.cycle?.name}):
- Areas to Improve: ${review.managerReview?.areasToImprove || 'Not specified'}
- Recommended Development: ${review.managerReview?.developmentPlan || 'Not specified'}
- Evaluator Comments: ${review.managerReview?.ratingDiffReason || 'Comprehensive review required'}
  `.trim();

  const draftPip = await Warning.create({
    employee: review.employee._id,
    type: 'pip',
    title: `PIP Recommendation: ${review.cycle?.name}`,
    reason: `Low evaluation outcome or specific improvement required following ${review.cycle?.name}.`,
    issuedBy: user._id,
    issuedAt: new Date(),
    status: 'draft', // DRAFT ONLY
    improvementPlan: improvementPlanText,
  });

  await logAudit({
    req,
    action: 'RECOMMEND_DRAFT_PIP',
    entity: 'Warning',
    entityId: draftPip._id,
    changes: { employee: review.employee._id, status: 'draft' },
  });

  return draftPip;
};

/**
 * 10. Fetch Linked Project and Task Read-Only Context
 * "Clearly labelled context, not a score"
 */
export const getReviewWorkContext = async (employeeId, startDate, endDate) => {
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), 0, 1);
  const end = endDate ? new Date(endDate) : new Date();

  // 1. Tasks completed by employee in period
  const completedTasks = await Task.countDocuments({
    assignees: employeeId,
    status: 'completed',
    updatedAt: { $gte: start, $lte: end },
  });

  const totalTasks = await Task.countDocuments({
    assignees: employeeId,
    createdAt: { $gte: start, $lte: end },
  });

  // 2. Logged hours in period
  const timeEntries = await TimeEntry.find({
    employee: employeeId,
    date: { $gte: start, $lte: end },
    status: 'approved',
  });

  const totalMinutes = timeEntries.reduce((acc, t) => acc + (t.durationMinutes || 0), 0);
  const totalHours = Number((totalMinutes / 60).toFixed(1));

  return {
    disclaimer: 'Read-only operational activity provided as context, never as a score or evaluation verdict.',
    completedTasks,
    totalTasks,
    totalHours,
  };
};

/**
 * 11. Scoped View of Reviews
 * Employees see only own review (and manager ratings hidden before publish!)
 * Managers see only direct reports (and own review)
 * HR / Super Admin see all
 */
export const getScopedReviews = async ({ user, userRole, employeeId, cycleId = null }) => {
  const query = {};
  if (cycleId) query.cycle = cycleId;

  if (userRole === 'employee') {
    // Only own reviews
    query.employee = employeeId;
  } else if (['project_manager', 'manager'].includes(userRole)) {
    // Direct reports OR own
    query.$or = [{ manager: employeeId }, { employee: employeeId }];
  }
  // HR / Super Admin: see all

  const reviews = await PerformanceReview.find(query)
    .populate('cycle', 'name type periodStart periodEnd status')
    .populate('employee', 'personal.firstName personal.lastName employeeId employment.designation employment.department')
    .populate('manager', 'personal.firstName personal.lastName employeeId')
    .sort({ createdAt: -1 });

  // Sanitize review output according to confidentiality scoping:
  return reviews.map((r) => sanitizeReviewForUser(r, user, userRole, employeeId));
};

/**
 * Sanitize single review according to role permissions
 */
export const sanitizeReviewForUser = (reviewDoc, user, userRole, employeeId) => {
  const r = reviewDoc.toObject ? reviewDoc.toObject() : { ...reviewDoc };
  const isOwner = String(r.employee?._id || r.employee) === String(employeeId);
  const isManager = String(r.manager?._id || r.manager) === String(employeeId);
  const isHRorSuperAdmin = ['super_admin', 'admin', 'hr'].includes(userRole);

  // If user is the reviewed employee:
  if (isOwner && !isHRorSuperAdmin) {
    // 1. Manager ratings are HIDDEN until published!
    if (!r.isPublished) {
      r.managerReview = {
        submittedAt: r.managerReview?.submittedAt || null,
        // Hide ratings and comments prior to publication
        sectionResponses: [],
        finalOverallRating: null,
        recommendedRating: null,
      };
    }
    // 2. Internal recommendation notes (promotion, increment, PIP notes) NEVER visible to employee
    if (r.managerReview) {
      delete r.managerReview.recommendationNotes;
      delete r.managerReview.ratingDiffReason;
    }
  }

  // Hide internal notes from non-HR/Super Admin if manager is an outsider
  if (!isOwner && !isManager && !isHRorSuperAdmin) {
    return null;
  }

  return r;
};
