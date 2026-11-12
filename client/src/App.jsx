import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { Home } from './pages/Home';
import { HRMS } from './pages/HRMS';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { MyProfile } from './pages/MyProfile';
import { Configurations } from './pages/Configurations';
import { ComingSoon } from './pages/ComingSoon';

export const App = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected password setup route */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Protected App Layout routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="my-profile" element={<MyProfile />} />

        {/* HRMS Module (Admin & HR) */}
        <Route
          path="hrms"
          element={
            <ProtectedRoute requiredPermission="employee.read">
              <HRMS />
            </ProtectedRoute>
          }
        />
        <Route path="hrms/employees/:id" element={<EmployeeDetail />} />

        {/* Configurations Module (Super Admin & Admin) */}
        <Route
          path="configurations"
          element={
            <ProtectedRoute requiredPermission="user.manage">
              <Configurations />
            </ProtectedRoute>
          }
        />

        {/* Coming Soon roadmap modules */}
        <Route path="modules/:name" element={<ComingSoon />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
