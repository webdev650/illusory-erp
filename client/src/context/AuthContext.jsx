import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', { email, password });
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        return res.data.user;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Logout error', err);
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    if (res.success) {
      // Clear the mustChangePassword flag locally
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
    }
    return res;
  };

  const role = user?.role?.key || 'employee';
  const permissions = user?.role?.permissions || [];

  const hasPermission = (key) => {
    if (!user) return false;
    if (permissions.includes('*')) return true;
    if (Array.isArray(key)) return key.some((k) => permissions.includes(k));
    return permissions.includes(key);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        loading,
        error,
        login,
        logout,
        changePassword,
        hasPermission,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

