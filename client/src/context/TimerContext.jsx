import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const TimerContext = createContext(null);

export const TimerProvider = ({ children }) => {
  const { user, hasPermission } = useAuth();
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  // Helper to calculate seconds from startedAt
  const computeElapsed = (startedAt) => {
    if (!startedAt) return 0;
    const startMs = new Date(startedAt).getTime();
    const nowMs = Date.now();
    return Math.max(0, Math.floor((nowMs - startMs) / 1000));
  };

  // Fetch active timer from backend
  const fetchActiveTimer = useCallback(async () => {
    if (!user || !hasPermission('activity.logOwn')) {
      setActiveTimer(null);
      setElapsedSeconds(0);
      return;
    }
    try {
      const res = await api.get('/activity/timer');
      if (res.success && res.data) {
        setActiveTimer(res.data);
        setElapsedSeconds(computeElapsed(res.data.startedAt));
      } else {
        setActiveTimer(null);
        setElapsedSeconds(0);
      }
    } catch (err) {
      // Ignore background 404 or auth errors
      setActiveTimer(null);
    }
  }, [user, hasPermission]);

  // Initial fetch and polling every 60 seconds to sync server timer
  useEffect(() => {
    fetchActiveTimer();
    const interval = setInterval(fetchActiveTimer, 60000);
    return () => clearInterval(interval);
  }, [fetchActiveTimer]);

  // Second-by-second ticker when timer is running
  useEffect(() => {
    if (!activeTimer?.startedAt) return;

    // Immediately compute
    setElapsedSeconds(computeElapsed(activeTimer.startedAt));

    const ticker = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(ticker);
  }, [activeTimer]);

  // Start Timer
  const startTimer = async ({ project, task, description, isBillable = true, category = 'project_work' }) => {
    try {
      setLoading(true);
      const res = await api.post('/activity/timer/start', {
        project: project || undefined,
        task: task || undefined,
        description: description || 'Working on task',
        isBillable,
        category,
      });

      if (res.success) {
        setActiveTimer(res.data);
        setElapsedSeconds(0);
        return res.data;
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to start timer';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Stop Timer
  const stopTimer = async (descriptionOverride) => {
    try {
      setLoading(true);
      const body = descriptionOverride ? { description: descriptionOverride } : {};
      const res = await api.post('/activity/timer/stop', body);
      if (res.success) {
        setActiveTimer(null);
        setElapsedSeconds(0);
        return res.data; // Newly created TimeEntry
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to stop timer';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Discard Timer
  const discardTimer = async () => {
    try {
      setLoading(true);
      const res = await api.delete('/activity/timer');
      if (res.success) {
        setActiveTimer(null);
        setElapsedSeconds(0);
        return true;
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to discard timer';
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting: HH:MM:SS
  const formatDuration = (totalSecs) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // Is timer running for more than 12 hours
  const isForgotten = elapsedSeconds > 12 * 3600;

  return (
    <TimerContext.Provider
      value={{
        activeTimer,
        isRunning: Boolean(activeTimer),
        elapsedSeconds,
        formattedElapsed: formatDuration(elapsedSeconds),
        isForgotten,
        loading,
        startTimer,
        stopTimer,
        discardTimer,
        refreshTimer: fetchActiveTimer,
        formatDuration,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
