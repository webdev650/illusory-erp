import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import * as perfController from '../controllers/performance.controller.js';

const router = Router();

// Require authentication for all performance endpoints
router.use(requireAuth);

// 1. Overview and Self Dashboard
router.get('/summary', perfController.getPerformanceSummary);
router.get('/reports', perfController.getPerformanceSummary);
router.get('/me', perfController.getMyPerformance);

// 2. Review Cycles
router.get('/cycles', perfController.listCycles);
router.post('/cycles', requirePermission('performance.cycle.manage'), perfController.createCycle);
router.post('/cycles/:id/start', requirePermission('performance.cycle.manage'), perfController.startCycle);
router.post('/cycles/:id/publish', requirePermission('performance.publish'), perfController.publishCycle);
router.post('/cycles/:id/close', requirePermission('performance.cycle.manage'), perfController.closeCycle);

// 3. Review Templates
router.get('/templates', perfController.listTemplates);
router.post('/templates', requirePermission('performance.template.manage'), perfController.createTemplate);

// 4. Goals (OKR)
router.get('/goals', perfController.listGoals);
router.post('/goals', requirePermission('performance.goal.manage'), perfController.createGoal);
router.post('/goals/:id/updates', perfController.addGoalProgressUpdate);
router.post('/goals/:id/approve', requirePermission('performance.goal.approve'), async (req, res, next) => {
  // Directly approve via goal approval endpoint or delegate
  req.body.action = 'approved';
  next();
}, perfController.addGoalProgressUpdate);

// 5. Reviews Workflow
router.get('/reviews', perfController.listReviews);
router.get('/reviews/:id', perfController.getReviewById);
router.post('/reviews/:id/self', perfController.submitSelfReview);
router.post('/reviews/:id/manager', requirePermission(['performance.reviewTeam', 'hr.access']), perfController.submitManagerReview);
router.post('/reviews/:id/calibrate', requirePermission('performance.calibrate'), perfController.calibrateReview);
router.post('/reviews/:id/publish', requirePermission('performance.publish'), perfController.publishSingleReview);
router.post('/reviews/:id/acknowledge', perfController.acknowledgeReview);
router.post('/reviews/:id/respond', perfController.acknowledgeReview);
router.post('/reviews/:id/update-rating', requirePermission('performance.calibrate'), perfController.updateRatingPostPublish);
router.post('/reviews/:id/recommend-pip', requirePermission('hr.access'), perfController.recommendDraftPIP);
router.get('/reviews/:id/work-context', perfController.getReviewWorkContext);

// 6. 360 Feedback
router.post('/360/nominate', perfController.nominatePeer);
router.post('/360/respond', perfController.submitPeerFeedback);

// 7. 1:1 Meetings
router.get('/one-on-ones', perfController.listOneOnOnes);
router.post('/one-on-ones', perfController.createOneOnOne);

// 8. Continuous Feedback & Kudos
router.get('/feedback', perfController.listFeedback);
router.post('/feedback', requirePermission('performance.feedback.give'), perfController.giveFeedback);

// 9. Settings & Export
router.get('/settings', perfController.getSettings);
router.put('/settings', requirePermission('performance.configure'), perfController.updateSettings);
router.get('/export', requirePermission('performance.export'), perfController.exportPerformanceData);

export default router;
