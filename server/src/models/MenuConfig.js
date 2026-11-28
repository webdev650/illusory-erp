import mongoose from 'mongoose';

const menuConfigSchema = new mongoose.Schema(
  {
    roleKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
    },
    allowedModuleKeys: {
      type: [String],
      required: true,
      default: ['home'],
    },
    allowedSubmenuKeys: {
      type: Map,
      of: [String],
      default: {},
    },
    topTabs: {
      type: [
        {
          label: String,
          path: String,
          key: String,
        },
      ],
      default: [],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

export const DEFAULT_ROLE_MENUS = [
  {
    roleKey: 'employee',
    label: 'Employee Role Menu',
    allowedModuleKeys: ['home', 'hrms', 'projects', 'support', 'utilities'],
    allowedSubmenuKeys: {
      hrms: [
        'my-profile',
        'attendance-calendar',
        'attendance-leave',
        'attendance-regularization',
        'attendance-remote-work',
        'my-letters',
        'my-warnings',
        'my-performance',
        'company-directory',
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
  {
    roleKey: 'manager',
    label: 'Project Manager Role Menu',
    allowedModuleKeys: ['home', 'hrms', 'projects', 'support', 'utilities', 'approvals'],
    allowedSubmenuKeys: {
      hrms: [
        'my-profile',
        'attendance-calendar',
        'attendance-leave',
        'attendance-regularization',
        'attendance-remote-work',
        'my-letters',
        'my-warnings',
        'my-performance',
        'company-directory',
        'team-attendance',
        'team-performance',
      ],
      projects: ['my-projects', 'my-tasks', 'my-timesheet', 'meetings', 'team-projects', 'team-tasks'],
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
  {
    roleKey: 'hr',
    label: 'Human Resources Role Menu',
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
    allowedSubmenuKeys: {},
    topTabs: [
      { label: 'Home', path: '/', key: 'home' },
      { label: 'HR', path: '/hr', key: 'hr' },
      { label: 'Tasks', path: '/tasks', key: 'tasks' },
      { label: 'Reports', path: '/modules/reports', key: 'reports' },
      { label: 'Approvals', path: '/approvals', key: 'approvals' },
      { label: 'Meetings', path: '/modules/meetings', key: 'meetings' },
    ],
  },
  {
    roleKey: 'super_admin',
    label: 'Super Admin Full Menu',
    allowedModuleKeys: [
      'home',
      'hrms',
      'hr',
      'projects',
      'payroll',
      'finance',
      'crm',
      'recruitment',
      'assets',
      'travel-expenses',
      'reports',
      'support',
      'utilities',
      'configurations',
      'meetings',
      'approvals',
    ],
    allowedSubmenuKeys: {},
    topTabs: [
      { label: 'Home', path: '/', key: 'home' },
      { label: 'HR', path: '/hr', key: 'hr' },
      { label: 'Tasks', path: '/tasks', key: 'tasks' },
      { label: 'Reports', path: '/modules/reports', key: 'reports' },
      { label: 'Approvals', path: '/approvals', key: 'approvals' },
      { label: 'Meetings', path: '/modules/meetings', key: 'meetings' },
    ],
  },
];

export const MenuConfig = mongoose.model('MenuConfig', menuConfigSchema);
