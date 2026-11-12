import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { Home } from './pages/Home';
import { HRMS } from './pages/HRMS';
import { EmployeeDetail } from './pages/EmployeeDetail';
import { HRDashboard } from './pages/HRDashboard';
import { Approvals } from './pages/Approvals';
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

        {/* HR Operations Module (Attendance, Leaves, Holidays, Approvals) */}
        <Route
          path="hr"
          element={
            <ProtectedRoute requiredPermission="hr.access">
              <HRDashboard />
            </ProtectedRoute>
          }
        />

        {/* HRMS Module (Employee Master) */}
        <Route
          path="hrms"
          element={
            <ProtectedRoute requiredPermission="employee.read">
              <HRMS />
            </ProtectedRoute>
          }
        />
        <Route path="hrms/employees/:id" element={<EmployeeDetail />} />

        {/* Approvals Portal */}
        <Route path="approvals" element={<Approvals />} />

        {/* Configurations Module (Super Admin & Admin) */}
        <Route
          path="configurations"
          element={
            <ProtectedRoute requiredPermission="user.manage">
              <Configurations />
            </ProtectedRoute>
          }
        />

        {/* All roadmap modules dynamically mapped */}
        <Route path="modules/:name" element={<ComingSoon />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
