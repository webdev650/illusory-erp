import mongoose from 'mongoose';

const userPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    homeLayout: {
      type: [String],
      default: [
        'welcome',
        'kpi',
        'my_tasks',
        'tasks_due',
        'weekly_hours',
        'my_projects',
        'leave_balance',
        'team_on_leave',
        'pending_approvals',
        'announcements',
        'upcoming_holidays',
        'celebrations',
        'charts',
      ],
    },
    hiddenWidgets: {
      type: [String],
      default: [],
    },
    pinnedModules: {
      type: [String],
      default: ['home', 'hrms', 'hr', 'tasks', 'activity_tracker'],
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light',
    },
    sidebarCollapsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);
export default UserPreference;
