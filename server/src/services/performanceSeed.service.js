import { ReviewTemplate } from '../models/ReviewTemplate.js';
import { LetterTemplate } from '../models/LetterTemplate.js';
import { PerformanceSettings } from '../models/PerformanceSettings.js';

export const seedPerformanceDefaults = async () => {
  // 1. Seed Sample Review Templates
  const annualTemplate = await ReviewTemplate.findOneAndUpdate(
    { code: 'ANNUAL-REVIEW-V1' },
    {
      name: 'Annual Performance Review (Sample)',
      code: 'ANNUAL-REVIEW-V1',
      type: 'annual',
      version: 1,
      isSample: true,
      unverified: true, // "sample, confirm with HR"
      status: 'active',
      ratingScale: {
        min: 1,
        max: 5,
        requireCommentOnExtreme: true,
        labels: [
          { score: 1, label: 'Unsatisfactory', description: 'Performance falls substantially below studio standards' },
          { score: 2, label: 'Needs Improvement', description: 'Partially meets expectations; requires focused development' },
          { score: 3, label: 'Meets Expectations', description: 'Consistently meets role expectations and studio deliverables' },
          { score: 4, label: 'Exceeds Expectations', description: 'Frequently surpasses goals, showing proactive leadership' },
          { score: 5, label: 'Outstanding', description: 'Exceptional craft, role model for company values' },
        ],
      },
      sections: [
        {
          key: 'goals',
          title: 'Objectives & Key Results (OKRs)',
          weight: 40,
          description: 'Evaluation of quantitative goal deliverables and project milestones',
          questions: [
            { id: 'q_goal_achieve', question: 'How effectively did the employee deliver on agreed annual objectives?', type: 'rating', required: true },
            { id: 'q_goal_quality', question: 'Evaluate the quality and technical craftsmanship of deliverables', type: 'rating', required: true },
          ],
          completedBy: ['employee', 'manager'],
          visibility: ['employee', 'manager', 'hr', 'super_admin'],
        },
        {
          key: 'competencies',
          title: 'Core Competencies & Studio Craft',
          weight: 30,
          description: 'Problem solving, collaboration, client communication, and execution speed',
          questions: [
            { id: 'q_comp_collab', question: 'Demonstrates cross-functional collaboration and mentorship', type: 'rating', required: true },
            { id: 'q_comp_problem', question: 'Exhibits creative problem-solving under studio deadlines', type: 'rating', required: true },
          ],
          completedBy: ['employee', 'manager', 'peers'],
          visibility: ['employee', 'manager', 'hr', 'super_admin'],
        },
        {
          key: 'values',
          title: 'Studio Values & Culture',
          weight: 30,
          description: 'Integrity, curiosity, user-centric empathy, and mutual respect',
          questions: [
            { id: 'q_val_culture', question: 'Embodies studio culture, ownership, and respectful feedback', type: 'rating', required: true },
          ],
          completedBy: ['employee', 'manager', 'peers'],
          visibility: ['employee', 'manager', 'hr', 'super_admin'],
        },
      ],
      weightings: { goals: 40, competencies: 30, values: 30 },
    },
    { upsert: true, new: true }
  );

  const probationTemplate = await ReviewTemplate.findOneAndUpdate(
    { code: 'PROBATION-REVIEW-V1' },
    {
      name: 'Probation Confirmation Review (Sample)',
      code: 'PROBATION-REVIEW-V1',
      type: 'probation',
      version: 1,
      isSample: true,
      unverified: true, // "sample, confirm with HR"
      status: 'active',
      ratingScale: {
        min: 1,
        max: 5,
        requireCommentOnExtreme: true,
        labels: [
          { score: 1, label: 'Not Suitable', description: 'Significant gaps observed during probationary period' },
          { score: 2, label: 'Extension Recommended', description: 'Shows potential but needs extension to assess fit' },
          { score: 3, label: 'Confirmed Fit', description: 'Meets studio requirements; ready for confirmation' },
          { score: 4, label: 'Strong Fit', description: 'Quick onboarding and positive team impact' },
          { score: 5, label: 'Exceptional Addition', description: 'Outperformed role requirements in probation' },
        ],
      },
      sections: [
        {
          key: 'goals',
          title: 'Probation Onboarding Goals',
          weight: 50,
          description: 'Initial 90-day learning curve and project contributions',
          questions: [
            { id: 'q_prob_ramp', question: 'Speed of onboarding and grasp of studio workflows', type: 'rating', required: true },
            { id: 'q_prob_output', question: 'Initial project task output and adherence to guidelines', type: 'rating', required: true },
          ],
          completedBy: ['employee', 'manager'],
          visibility: ['employee', 'manager', 'hr', 'super_admin'],
        },
        {
          key: 'competencies',
          title: 'Team Dynamics & Conduct',
          weight: 50,
          description: 'Attendance discipline, communication, and receptiveness to feedback',
          questions: [
            { id: 'q_prob_feedback', question: 'Response to design critique and team collaboration', type: 'rating', required: true },
            { id: 'q_prob_discipline', question: 'Punctuality, meeting attendance, and studio etiquette', type: 'rating', required: true },
          ],
          completedBy: ['employee', 'manager'],
          visibility: ['employee', 'manager', 'hr', 'super_admin'],
        },
      ],
      weightings: { goals: 50, competencies: 50 },
    },
    { upsert: true, new: true }
  );

  // 2. Seed Sample Letter Templates
  await LetterTemplate.findOneAndUpdate(
    { code: 'SAMPLE_INCREMENT' },
    {
      name: 'Salary Increment Letter (Sample - Unreviewed)',
      code: 'SAMPLE_INCREMENT',
      category: 'increment',
      body: `
        <div style="font-family: 'Inter', sans-serif; line-height: 1.7; color: #1e293b;">
          <p>Date: {{date}}</p>
          <p>Dear <strong>{{employee_name}}</strong>,</p>
          <p>Following your recent performance evaluation for the period <strong>{{review_period}}</strong>, we are delighted to inform you that your compensation has been revised.</p>
          <p>Effective from <strong>{{effective_date}}</strong>, your revised Cost to Company (CTC) will be <strong>{{revised_ctc}}</strong> per annum.</p>
          <p>We appreciate your dedication and valuable contributions to Illusory Design Studios.</p>
          <br/>
          <p>Warm regards,</p>
          <p><strong>{{signatory_name}}</strong><br/>{{signatory_designation}}<br/>Illusory Design Studios Pvt. Ltd.</p>
        </div>
      `,
      status: 'active',
    },
    { upsert: true }
  );

  await LetterTemplate.findOneAndUpdate(
    { code: 'SAMPLE_PROMOTION' },
    {
      name: 'Promotion Letter (Sample - Unreviewed)',
      code: 'SAMPLE_PROMOTION',
      category: 'promotion',
      body: `
        <div style="font-family: 'Inter', sans-serif; line-height: 1.7; color: #1e293b;">
          <p>Date: {{date}}</p>
          <p>Dear <strong>{{employee_name}}</strong>,</p>
          <p>In recognition of your exceptional performance and leadership, the management is pleased to promote you to the position of <strong>{{new_designation}}</strong> effective from <strong>{{effective_date}}</strong>.</p>
          <p>In this elevated capacity, your contributions will play a pivotal role in driving our studio's design and technological excellence.</p>
          <br/>
          <p>Congratulations and best wishes,</p>
          <p><strong>{{signatory_name}}</strong><br/>{{signatory_designation}}<br/>Illusory Design Studios Pvt. Ltd.</p>
        </div>
      `,
      status: 'active',
    },
    { upsert: true }
  );

  await LetterTemplate.findOneAndUpdate(
    { code: 'SAMPLE_APPRAISAL_SUMMARY' },
    {
      name: 'Appraisal Summary Letter (Sample - Unreviewed)',
      code: 'SAMPLE_APPRAISAL_SUMMARY',
      category: 'custom',
      body: `
        <div style="font-family: 'Inter', sans-serif; line-height: 1.7; color: #1e293b;">
          <p>Date: {{date}}</p>
          <p>Dear <strong>{{employee_name}}</strong>,</p>
          <p>This letter summarizes the outcome of your Performance Appraisal for the cycle <strong>{{cycle_name}}</strong>.</p>
          <p><strong>Overall Evaluation Rating:</strong> {{final_rating}} / 5.0</p>
          <p><strong>Key Strengths Noted:</strong><br/>{{strengths}}</p>
          <p><strong>Areas for Continued Growth:</strong><br/>{{development_plan}}</p>
          <br/>
          <p>Sincerely,</p>
          <p><strong>Human Resources</strong><br/>Illusory Design Studios Pvt. Ltd.</p>
        </div>
      `,
      status: 'active',
    },
    { upsert: true }
  );

  // 3. Seed Performance Settings
  let settings = await PerformanceSettings.findOne();
  if (!settings) {
    settings = await PerformanceSettings.create({
      ratingScaleLabels: [
        { score: 1, label: 'Unsatisfactory', description: 'Performance falls substantially below expected studio standards; requires required comment' },
        { score: 2, label: 'Needs Improvement', description: 'Partially meets expectations; development plan required' },
        { score: 3, label: 'Meets Expectations', description: 'Consistently meets professional performance benchmarks' },
        { score: 4, label: 'Exceeds Expectations', description: 'Frequently surpasses deliverables and demonstrates initiative' },
        { score: 5, label: 'Outstanding', description: 'Exceptional contribution, role-model design/craftsmanship; requires required comment' },
      ],
      defaultWeightings: { goals: 40, competencies: 30, values: 30 },
      calibrationEnabled: true,
      enable360ByDefault: false,
      anonymity360: true,
      minResponses360: 2,
      minGroupSizeForCharts: 3,
      goalApprovalRequired: true,
      probationReviewLeadDays: 15,
      resultsVisibility: 'after_publish_only',
      retentionYears: 3,
      noticeText: "Review rating scales, weightings and consequences must follow the company's HR policy; confirm with HR.",
      policyConfirmed: false,
    });
  }

  return { annualTemplate, probationTemplate, settings };
};
