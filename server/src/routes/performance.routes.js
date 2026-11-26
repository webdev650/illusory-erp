import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth.js';
import * as perfController from '../controllers/performance.controller.js';

const router = Router();

// Require authentication for all performance endpoints
router.use(authenticate);

// 1. Overview and Self Dashboard
router.get('/summary', perfController.getPerformanceSummary);
router.get('/reports', perfController.getPerformanceSummary);
router.get('/me', perfController.getMyPerformance);

// 2. Review Cycles
router.get('/cycles', perfController.listCycles);
router.post('/cycles', checkPermission('performance.cycle.manage'), perfController.createCycle);
router.post('/cycles/:id/start', checkPermission('performance.cycle.manage'), perfController.startCycle);
router.post('/cycles/:id/publish', checkPermission('performance.publish'), perfController.publishCycle);
router.post('/cycles/:id/close', checkPermission('performance.cycle.manage'), perfController.closeCycle);

// 3. Review Templates
router.get('/templates', perfController.listTemplates);
router.post('/templates', checkPermission('performance.template.manage'), perfController.createTemplate);

// 4. Goals (OKR)
router.get('/goals', perfController.listGoals);
router.post('/goals', checkPermission('performance.goal.manage'), perfController.createGoal);
router.post('/goals/:id/updates', perfController.addGoalProgressUpdate);
router.post('/goals/:id/approve', checkPermission('performance.goal.approve'), async (req, res, next) => {
  // Directly approve via goal approval endpoint or delegate
  req.body.action = 'approved';
  next();
}, perfController.addGoalProgressUpdate);

// 5. Reviews Workflow
router.get('/reviews', perfController.listReviews);
router.get('/reviews/:id', perfController.getReviewById);
router.post('/reviews/:id/self', perfController.submitSelfReview);
router.post('/reviews/:id/manager', checkPermission(['performance.reviewTeam', 'hr.access']), perfController.submitManagerReview);
router.post('/reviews/:id/calibrate', checkPermission('performance.calibrate'), perfController.calibrateReview);
router.post('/reviews/:id/publish', checkPermission('performance.publish'), perfController.publishSingleReview);
router.post('/reviews/:id/acknowledge', perfController.acknowledgeReview);
router.post('/reviews/:id/respond', perfController.acknowledgeReview);
router.post('/reviews/:id/update-rating', checkPermission('performance.calibrate'), perfController.updateRatingPostPublish);
router.post('/reviews/:id/recommend-pip', checkPermission('hr.access'), perfController.recommendDraftPIP);
router.get('/reviews/:id/work-context', perfController.getReviewWorkContext);

// 6. 360 Feedback
router.post('/360/nominate', perfController.nominatePeer);
router.post('/360/respond', perfController.submitPeerFeedback);

// 7. 1:1 Meetings
router.get('/one-on-ones', perfController.listOneOnOnes);
router.post('/one-on-ones', perfController.createOneOnOne);

// 8. Continuous Feedback & Kudos
router.get('/feedback', perfController.listFeedback);
router.post('/feedback', checkPermission('performance.feedback.give'), perfController.giveFeedback);

// 9. Settings & Export
router.get('/settings', perfController.getSettings);
router.put('/settings', checkPermission('performance.configure'), perfController.updateSettings);
router.get('/export', checkPermission('performance.export'), perfController.exportPerformanceData);

export default router;
