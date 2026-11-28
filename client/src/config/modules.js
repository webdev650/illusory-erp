/**
 * Master Registry of all 16 ERP Modules for Illusory ERP
 * Shared architectural definition used by both Backend RBAC and Frontend Sidebar
 */

export const ERP_MODULES = [
  {
    key: 'home',
    label: 'Home',
    icon: 'Home',
    path: '/',
    status: 'live',
    requiredPermission: null,
    description: 'Personal overview, studio metrics, quick punch clock, and agency announcements',
  },
  {
    key: 'hrms',
    label: 'People & HR',
    icon: 'Users',
    path: '/hrms',
    status: 'live',
    requiredPermission: ['employee.read', 'employee.readSelf'],
    description: 'Complete employee directory, profile management, onboarding wizard, and document records',
    children: [
      {
        key: 'my-profile',
        label: 'My Profile',
        icon: 'User',
        path: '/my-profile',
        status: 'live',
        requiredPermission: 'employee.readSelf',
        description: 'View and update your personal details, emergency contacts, and active devices',
      },
      {
        key: 'hrms-dashboard',
        label: 'HRMS Dashboard',
        icon: 'LayoutDashboard',
        path: '/hrms/dashboard',
        status: 'live',
        requiredPermission: 'hrms.dashboard.view',
        description: 'Comprehensive workforce statistics, headcount trends, and late attendance tracking',
      },
      {
        key: 'attendance-calendar',
        label: 'Attendance Calendar',
        icon: 'Calendar',
        path: '/hrms/attendance/calendar',
        status: 'live',
        requiredPermission: ['attendance.read', 'attendance.readSelf'],
        description: 'Month calendar with daily log statuses, work hours, breaks, and late counts',
      },
      {
        key: 'attendance-leave',
        label: 'Apply Leave',
        icon: 'FileText',
        path: '/hrms/attendance/leave',
        status: 'live',
        requiredPermission: 'leave.apply',
        description: 'Request casual, sick, annual, bereavement, or unpaid leave',
      },
      {
        key: 'attendance-regularization',
        label: 'Apply Log Regularization',
        icon: 'Clock',
        path: '/hrms/attendance/regularization',
        status: 'live',
        requiredPermission: 'attendance.record',
        description: 'Submit clock in/out regularization requests for missed punches',
      },
      {
        key: 'attendance-remote-work',
        label: 'Apply Remote Work',
        icon: 'Home',
        path: '/hrms/attendance/remote-work',
        status: 'live',
        requiredPermission: 'attendance.remoteWork',
        description: 'Apply for work-from-home or off-site client engagement days',
      },
      {
        key: 'hrms-letters',
        label: 'My Letters and Requests',
        icon: 'FileText',
        path: '/hrms/letters',
        status: 'live',
        requiredPermission: ['letter.view', 'letter.readSelf'],
        description: 'View received appointment letters, appraisal summaries, and submit letter requests',
      },
      {
        key: 'hrms-warnings',
        label: 'My Warnings and PIP',
        icon: 'AlertTriangle',
        path: '/hrms/warnings',
        status: 'live',
        requiredPermission: ['hr.access', 'employee.readSelf'],
        description: 'Confidential formal notices and performance improvement plan milestones',
      },
      {
        key: 'hrms-performance',
        label: 'My Performance',
        icon: 'TrendingUp',
        path: '/hrms/performance',
        status: 'live',
        requiredPermission: 'performance.viewOwn',
        description: 'Review cycles, OKR goals, 360 feedback, 1:1 syncs, and self-evaluations',
      },
      {
        key: 'hrms-employees',
        label: 'Company Directory',
        icon: 'Users',
        path: '/hrms/employees',
        status: 'live',
        requiredPermission: ['employee.read', 'employee.readSelf'],
        description: 'Staff directory with grid/table views, profiles, and export options',
      },
      // Management & Admin only subpages below:
      {
        key: 'attendance-manage-logs',
        label: 'Manage Logs',
        icon: 'Edit2',
        path: '/hrms/attendance/manage-logs',
        status: 'live',
        requiredPermission: 'attendance.manage',
        description: 'HR and managers audit, add missing biometric entries, and edit punch anomalies',
      },
      {
        key: 'attendance-bulk-logs',
        label: 'Manage Bulk In/Out',
        icon: 'Users',
        path: '/hrms/attendance/bulk-logs',
        status: 'live',
        requiredPermission: 'attendance.manage',
        description: 'Bulk check-in, check-out, and break logging for teams or entire departments',
      },
      {
        key: 'attendance-roster',
        label: 'Shift Roster',
        icon: 'CalendarDays',
        path: '/hrms/attendance/roster',
        status: 'live',
        requiredPermission: 'attendance.manage',
        description: 'Assign special shifts, manage department rosters, and handle schedule changes',
      },
      {
        key: 'attendance-settlement',
        label: 'Leave Balance Settlement',
        icon: 'CreditCard',
        path: '/hrms/attendance/settlement',
        status: 'live',
        requiredPermission: 'leave.settle',
        description: 'Annual leave carry-forward, lapsed quota calculation, and encashment finalization',
      },
      {
        key: 'attendance-reports',
        label: 'Attendance & Leave Reports',
        icon: 'FileSpreadsheet',
        path: '/hrms/attendance/reports',
        status: 'live',
        requiredPermission: 'reports.view',
        description: 'Audit registers, late arrival tracking, overtime, and leave ledgers',
      },
      {
        key: 'attendance-policy-confirmation',
        label: 'Rule Book Policy Confirmation',
        icon: 'ShieldCheck',
        path: '/hrms/attendance/policy-confirmation',
        status: 'live',
        requiredPermission: 'hr.access',
        description: 'Verify, review, and confirm company Rule Book Section 12 policy settings',
      },
      {
        key: 'hrms-approvals',
        label: 'HR Approvals',
        icon: 'CheckSquare',
        path: '/hrms/approvals',
        status: 'live',
        requiredPermission: 'approval.read',
        description: 'Pending leave, regularization, and HR requests awaiting decision',
      },
      {
        key: 'hrms-letters',
        label: 'Letters & Documents',
        icon: 'FileText',
        path: '/hrms/letters',
        status: 'live',
        requiredPermission: 'document.manage',
        description: 'Offer letters, experience certificates, and official documents',
      },
      {
        key: 'hrms-warnings',
        label: 'Warnings & PIP',
        icon: 'AlertTriangle',
        path: '/hrms/warnings',
        status: 'live',
        requiredPermission: 'hr.access',
        description: 'Formal notices, performance improvement plans, and tracking',
      },
      {
        key: 'hrms-engage',
        label: 'Engage',
        icon: 'Heart',
        path: '/hrms/engage',
        status: 'soon',
        requiredPermission: null,
        description: 'Pulse surveys, employee sentiment, recognition, and studio culture wall',
        plannedFeatures: [
          'Anonymous team feedback and pulse surveys',
          'Peer-to-peer appreciation badges and shoutouts',
          'Studio announcement comments and celebrations',
        ],
      },
      {
        key: 'hrms-training',
        label: 'Training & Development',
        icon: 'GraduationCap',
        path: '/hrms/training',
        status: 'soon',
        requiredPermission: null,
        description: 'Skill matrix, learning tracks, and internal workshops',
        plannedFeatures: [
          'Design and engineering training curriculums',
          'Certifications repository and renewal reminders',
          'Mentorship pairing and progression tracks',
        ],
      },
      {
        key: 'hrms-performance',
        label: 'Performance',
        icon: 'TrendingUp',
        path: '/hrms/performance',
        status: 'live',
        requiredPermission: 'performance.viewOwn',
        description: 'Review cycles, OKR goals, 360 feedback, 1:1 syncs, and calibration',
      },
    ],
  },
  {
    key: 'hr',
    label: 'HR Operations',
    icon: 'UserCheck',
    path: '/hr',
    status: 'live',
    requiredPermission: 'hr.access',
    description: 'Daily attendance tracker, check-in/out, leave applications, holiday calendars, approvals & announcements',
  },
  {
    key: 'projects',
    label: 'Project',
    icon: 'Briefcase',
    path: '/projects',
    status: 'live',
    requiredPermission: ['project.read', 'project.readOwn'],
    description: 'Client design & tech contracts, deliverables, milestones, budgets, and team allocation',
    children: [
      {
        key: 'my-projects',
        label: 'My Projects',
        icon: 'Briefcase',
        path: '/projects',
        status: 'live',
        requiredPermission: ['project.read', 'project.readOwn'],
      },
      {
        key: 'my-tasks',
        label: 'My Tasks',
        icon: 'CheckSquare',
        path: '/tasks',
        status: 'live',
        requiredPermission: ['task.read', 'task.readOwn'],
      },
      {
        key: 'my-timesheet',
        label: 'My Timesheet (Activity Tracker)',
        icon: 'Clock',
        path: '/timesheets',
        status: 'live',
        requiredPermission: ['activity.logOwn', 'activity.readOwn'],
      },
      {
        key: 'meetings',
        label: 'Meetings',
        icon: 'Video',
        path: '/modules/meetings',
        status: 'soon',
        requiredPermission: null,
      },
    ],
    plannedFeatures: [
      'Client project lifecycle management (Design & Development)',
      'Budget allocation vs actual hourly burn rate',
      'Deliverable sign-offs and client feedback portals',
      'Team resource capacity planning',
    ],
  },
  {
    key: 'tasks',
    label: 'Tasks',
    icon: 'CheckSquare',
    path: '/tasks',
    status: 'live',
    requiredPermission: ['task.read', 'task.readOwn'],
    description: 'Kanban boards, sprint view, task assignment, checklists, subtasks, and deadlines',
    plannedFeatures: [
      'Kanban board and sprint views',
      'Task assignment with automated notification alerts',
      'Checklists, file attachments, and completion milestones',
      'Time logging connected directly to attendance records',
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    icon: 'Building2',
    path: '/clients',
    status: 'live',
    requiredPermission: 'client.read',
    description: 'Client directory, agency accounts, contact persons, GST and contract history',
  },
  {
    key: 'payroll',
    label: 'Payroll',
    icon: 'CreditCard',
    path: '/modules/payroll',
    status: 'soon',
    requiredPermission: 'payroll.viewAll',
    description: 'Monthly payroll generation, salary structures, tax deductions, and automated payslips',
    plannedFeatures: [
      'Automated monthly salary slip generation with PDF download',
      'Integration with attendance and approved leaves for LOP deductions',
      'TDS, EPF, and ESI compliance calculator',
      'Bank disbursement bulk export file generator',
    ],
  },
  {
    key: 'recruitment',
    label: 'Recruitment & ATS',
    icon: 'UserPlus',
    path: '/modules/recruitment',
    status: 'soon',
    requiredPermission: 'recruitment.read',
    description: 'Job postings, applicant tracking, interview scorecards, and offer letter generation',
    plannedFeatures: [
      'Job requisition workflow with department approval',
      'Resume parsing and applicant status pipeline',
      'Interview scheduling with calendar invites',
      'Automated offer letter dispatch converted directly to employee record',
    ],
  },
  {
    key: 'crm',
    label: 'CRM & Pipeline',
    icon: 'TrendingUp',
    path: '/modules/crm',
    status: 'soon',
    requiredPermission: 'crm.viewAll',
    description: 'Lead generation, sales pipeline, client interaction logs, and proposal tracker',
    plannedFeatures: [
      'Lead qualification stages and deal value tracking',
      'Client proposal and quote builder with revision history',
      'Meeting minutes and follow-up reminders',
      'Revenue projection reports for design and engineering services',
    ],
  },
  {
    key: 'assets',
    label: 'Assets',
    icon: 'Box',
    path: '/assets',
    status: 'live',
    requiredPermission: ['asset.read', 'asset.readOwn'],
    description: 'Studio hardware inventory, MacBook/PC assignments, licenses, and maintenance logs',
    plannedFeatures: [
      'Hardware and software asset inventory registry with barcode/QR',
      'Asset allocation workflow linked with employee handover sign-offs',
      'Software license renewal alerts and subscription tracking',
      'Depreciation calculations and repair maintenance requests',
    ],
  },
  {
    key: 'travel_expense',
    label: 'Travel & Expense',
    icon: 'Plane',
    path: '/modules/travel',
    status: 'soon',
    requiredPermission: 'travel.read',
    description: 'Client visit travel approvals, expense claims, receipt uploads, and reimbursements',
    plannedFeatures: [
      'Client trip travel request with budget estimation',
      'Multi-currency expense claim submission with receipt upload',
      'Automated approval chain (Manager -> Finance -> Accounts)',
      'Reimbursement payment tracker connected with Payroll',
    ],
  },
  {
    key: 'activity_tracker',
    label: 'Activity Tracker',
    icon: 'Clock',
    path: '/tracker',
    status: 'live',
    requiredPermission: ['activity.logOwn', 'activity.readOwn', 'activity.readTeam', 'activity.readAll'],
    description: 'Daily agency timesheets, client billable hours, live timer, and team productivity logs',
    plannedFeatures: [
      'Daily work summary submissions per project',
      'Billable vs non-billable client hour analysis',
      'Lead and manager weekly timesheet approvals',
      'Productivity heatmap across studio disciplines',
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'BarChart3',
    path: '/modules/reports',
    status: 'soon',
    requiredPermission: 'report.view',
    description: 'Consolidated workforce, turnover, financial, and operational analytics',
    plannedFeatures: [
      'Employee retention and turnover metrics',
      'Departmental expenditure and salary growth trend reports',
      'Custom filterable CSV and PDF report builder',
      'Scheduled automated executive email summaries',
    ],
  },
  {
    key: 'support',
    label: 'Support',
    icon: 'HelpCircle',
    path: '/modules/support',
    status: 'soon',
    requiredPermission: null,
    description: 'Internal IT, hardware, facilities, and HR query ticketing system',
    children: [
      {
        key: 'my-tickets',
        label: 'Raise & Track My Tickets',
        icon: 'HelpCircle',
        path: '/modules/support',
        status: 'soon',
        requiredPermission: null,
      },
    ],
    plannedFeatures: [
      'Internal ticket submission (IT, Facilities, HR, Finance)',
      'SLA timers and priority escalation',
      'Resolution comments and satisfaction ratings',
      'Internal knowledge base and FAQs',
    ],
  },
  {
    key: 'utilities',
    label: 'Utilities',
    icon: 'Wrench',
    path: '/modules/utilities',
    status: 'soon',
    requiredPermission: null,
    description: 'Company policy library, document templates, meeting room booking, and studio directory',
    children: [
      {
        key: 'announcements',
        label: 'Announcements',
        icon: 'Sparkles',
        path: '/modules/utilities/announcements',
        status: 'soon',
        requiredPermission: null,
      },
      {
        key: 'documents',
        label: 'Documents',
        icon: 'FileText',
        path: '/modules/utilities/documents',
        status: 'soon',
        requiredPermission: null,
      },
      {
        key: 'policy-hub',
        label: 'Policy Hub',
        icon: 'ShieldCheck',
        path: '/modules/utilities/policies',
        status: 'soon',
        requiredPermission: null,
      },
      {
        key: 'holidays',
        label: 'Holidays',
        icon: 'Calendar',
        path: '/modules/utilities/holidays',
        status: 'soon',
        requiredPermission: null,
      },
      {
        key: 'faqs',
        label: 'FAQs',
        icon: 'HelpCircle',
        path: '/modules/utilities/faqs',
        status: 'soon',
        requiredPermission: null,
      },
    ],
    plannedFeatures: [
      'Studio meeting room and equipment booking calendar',
      'Official company policy documents and employee handbook',
      'Letter and contract template generator (NOC, Address Proof, Experience)',
      'Public holiday and studio event calendar',
    ],
  },
  {
    key: 'configurations',
    label: 'Configurations',
    icon: 'Settings',
    path: '/configurations',
    status: 'live',
    requiredPermission: 'user.manage',
    description: 'User access controls, dynamic role permissions matrix, and department management',
  },
  {
    key: 'meetings',
    label: 'Meetings',
    icon: 'Video',
    path: '/modules/meetings',
    status: 'soon',
    requiredPermission: null,
    description: 'Studio syncs, sprint standups, client calls, calendar invites, and room booking',
    plannedFeatures: [
      'Studio syncs, sprint standups, and client video calls',
      'Integration with Google Meet, Zoom, and Teams',
      'Studio meeting room and sound booth reservation calendar',
      'Meeting minutes and action items linked to project tasks',
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: 'DollarSign',
    path: '/modules/finance',
    status: 'soon',
    requiredPermission: 'finance.viewAll',
    description: 'Agency client invoicing, vendor bills, profit & loss, and GST reporting',
    plannedFeatures: [
      'Client invoice generation with GST compliance',
      'Vendor bill tracking and approval payments',
      'Income vs expense ledger and P&L statements',
      'Bank reconciliation and accountant exports',
    ],
  },
];

/**
 * Default role-to-menu mapping configuration
 */
export const DEFAULT_ROLE_MENUS = {
  employee: {
    allowedModuleKeys: ['home', 'hrms', 'projects', 'support', 'utilities'],
    allowedSubmenuKeys: {
      hrms: [
        'my-profile',
        'attendance-calendar',
        'attendance-leave',
        'attendance-regularization',
        'attendance-remote-work',
        'hrms-letters',
        'hrms-warnings',
        'hrms-performance',
        'hrms-employees',
      ],
      projects: ['my-projects', 'my-tasks', 'my-timesheet', 'meetings'],
      support: ['my-tickets'],
      utilities: ['announcements', 'documents', 'policy-hub', 'holidays', 'faqs'],
    },
    topTabs: [
      { label: 'Home', path: '/', key: 'home' },
      { label: 'Tasks', path: '/tasks', key: 'tasks' },
      { label: 'Meetings', path: '/modules/meetings', key: 'meetings' },
    ],
  },
  manager: {
    allowedModuleKeys: ['home', 'hrms', 'projects', 'support', 'utilities', 'approvals'],
    allowedSubmenuKeys: {
      hrms: [
        'my-profile',
        'attendance-calendar',
        'attendance-leave',
        'attendance-regularization',
        'attendance-remote-work',
        'hrms-letters',
        'hrms-warnings',
        'hrms-performance',
        'hrms-employees',
        'team-attendance',
        'team-performance',
      ],
      projects: ['my-projects', 'my-tasks', 'my-timesheet', 'meetings', 'team-projects'],
      support: ['my-tickets'],
      utilities: ['announcements', 'documents', 'policy-hub', 'holidays', 'faqs'],
    },
    topTabs: [
      { label: 'Home', path: '/', key: 'home' },
      { label: 'Tasks', path: '/tasks', key: 'tasks' },
      { label: 'Meetings', path: '/modules/meetings', key: 'meetings' },
      { label: 'Approvals', path: '/approvals', key: 'approvals' },
    ],
  },
  hr: {
    allowedModuleKeys: [
      'home',
      'hrms',
      'hr',
      'projects',
      'payroll',
      'recruitment',
      'support',
      'utilities',
      'reports',
      'approvals',
    ],
    allowedSubmenuKeys: null, // Full access to subpages
    topTabs: [
      { label: 'Home', path: '/', key: 'home' },
      { label: 'HR', path: '/hr', key: 'hr' },
      { label: 'Tasks', path: '/tasks', key: 'tasks' },
      { label: 'Reports', path: '/modules/reports', key: 'reports' },
      { label: 'Approvals', path: '/approvals', key: 'approvals' },
      { label: 'Meetings', path: '/modules/meetings', key: 'meetings' },
    ],
  },
  super_admin: {
    allowedModuleKeys: 'all',
    allowedSubmenuKeys: null,
    topTabs: [
      { label: 'Home', path: '/', key: 'home' },
      { label: 'HR', path: '/hr', key: 'hr' },
      { label: 'Tasks', path: '/tasks', key: 'tasks' },
      { label: 'Reports', path: '/modules/reports', key: 'reports' },
      { label: 'Approvals', path: '/approvals', key: 'approvals' },
      { label: 'Meetings', path: '/modules/meetings', key: 'meetings' },
    ],
  },
};

/**
 * Resolves the filtered modules and subpages for a given role and employee preferences
 */
export const resolveRoleMenu = ({ roleKey = 'employee', user = null, customConfig = null }) => {
  const config =
    customConfig ||
    DEFAULT_ROLE_MENUS[roleKey] ||
    DEFAULT_ROLE_MENUS.employee;

  const remoteWorkAllowed = user?.employee?.employment?.remoteWorkAllowed !== false;

  const allowedModules =
    config.allowedModuleKeys === 'all'
      ? ERP_MODULES
      : ERP_MODULES.filter((m) => config.allowedModuleKeys.includes(m.key));

  return allowedModules.map((mod) => {
    if (!mod.children) return mod;

    const allowedChildKeys =
      config.allowedSubmenuKeys?.[mod.key] ||
      (config.allowedSubmenuKeys instanceof Map ? config.allowedSubmenuKeys.get(mod.key) : null);

    let filteredChildren = mod.children;

    if (allowedChildKeys && Array.isArray(allowedChildKeys)) {
      filteredChildren = mod.children.filter((c) => allowedChildKeys.includes(c.key));
    }

    // Hide Remote Work if employee does not have remote work allowed
    if (mod.key === 'hrms' && !remoteWorkAllowed) {
      filteredChildren = filteredChildren.filter((c) => c.key !== 'attendance-remote-work');
    }

    return {
      ...mod,
      children: filteredChildren,
    };
  });
};

