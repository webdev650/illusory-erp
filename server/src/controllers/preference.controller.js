import { UserPreference } from '../models/UserPreference.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

// GET /api/v1/preferences
export const getMyPreferences = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let pref = await UserPreference.findOne({ user: userId });

    if (!pref) {
      pref = await UserPreference.create({
        user: userId,
        theme: 'light',
        sidebarCollapsed: false,
        pinnedModules: ['home', 'hrms', 'hr', 'tasks', 'activity_tracker'],
      });
    }

    return sendSuccess(res, pref, 'Preferences retrieved');
  } catch (err) {
    next(err);
  }
};

// PUT /api/v1/preferences
export const updateMyPreferences = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { homeLayout, hiddenWidgets, pinnedModules, theme, sidebarCollapsed } = req.body;

    const updates = {};
    if (homeLayout !== undefined) updates.homeLayout = homeLayout;
    if (hiddenWidgets !== undefined) updates.hiddenWidgets = hiddenWidgets;
    if (pinnedModules !== undefined) updates.pinnedModules = pinnedModules;
    if (theme !== undefined) updates.theme = theme;
    if (sidebarCollapsed !== undefined) updates.sidebarCollapsed = sidebarCollapsed;

    const pref = await UserPreference.findOneAndUpdate(
      { user: userId },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, pref, 'Preferences updated successfully');
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/preferences/reset-layout
export const resetHomeLayout = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const defaultLayout = [
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
    ];

    const pref = await UserPreference.findOneAndUpdate(
      { user: userId },
      { $set: { homeLayout: defaultLayout, hiddenWidgets: [] } },
      { new: true, upsert: true }
    );

    return sendSuccess(res, pref, 'Home layout reset to default');
  } catch (err) {
    next(err);
  }
};
