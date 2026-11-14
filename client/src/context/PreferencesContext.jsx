import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const PreferencesContext = createContext(null);

export const PreferencesProvider = ({ children }) => {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState({
    homeLayout: [
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
    hiddenWidgets: [],
    pinnedModules: ['home', 'hrms', 'hr', 'tasks', 'activity_tracker'],
    theme: 'light',
    sidebarCollapsed: false,
  });
  const [loading, setLoading] = useState(true);

  // Fetch preferences when user logs in
  useEffect(() => {
    if (!user) return;
    const fetchPref = async () => {
      try {
        const res = await api.get('/preferences');
        if (res.success && res.data) {
          setPreferences({
            homeLayout: res.data.homeLayout || [],
            hiddenWidgets: res.data.hiddenWidgets || [],
            pinnedModules: res.data.pinnedModules || ['home', 'hrms', 'hr', 'tasks', 'activity_tracker'],
            theme: res.data.theme || 'light',
            sidebarCollapsed: !!res.data.sidebarCollapsed,
          });

          // Sync theme to HTML root
          if (res.data.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      } catch (err) {
        // Fallback silently if offline or network error
      } finally {
        setLoading(false);
      }
    };
    fetchPref();
  }, [user]);

  // Persist update helper
  const updatePreferences = async (newPartial) => {
    setPreferences((prev) => ({ ...prev, ...newPartial }));
    try {
      await api.put('/preferences', newPartial);
    } catch (err) {
      // Revert or log
    }
  };

  // Toggle module pin in favourites
  const togglePinModule = (moduleKey) => {
    const current = preferences.pinnedModules || [];
    const updated = current.includes(moduleKey)
      ? current.filter((k) => k !== moduleKey)
      : [...current, moduleKey];

    updatePreferences({ pinnedModules: updated });
  };

  // Toggle sidebar collapse
  const toggleSidebarCollapse = () => {
    updatePreferences({ sidebarCollapsed: !preferences.sidebarCollapsed });
  };

  // Toggle theme
  const toggleTheme = () => {
    const nextTheme = preferences.theme === 'dark' ? 'light' : 'dark';
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updatePreferences({ theme: nextTheme });
  };

  // Reset home layout to default
  const resetLayout = async () => {
    try {
      const res = await api.post('/preferences/reset-layout');
      if (res.success && res.data) {
        setPreferences((prev) => ({
          ...prev,
          homeLayout: res.data.homeLayout,
          hiddenWidgets: res.data.hiddenWidgets,
        }));
      }
    } catch (err) {
      //
    }
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        loading,
        updatePreferences,
        togglePinModule,
        toggleSidebarCollapse,
        toggleTheme,
        resetLayout,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return ctx;
};

export default PreferencesContext;

