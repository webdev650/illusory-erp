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
import { Clients } from './pages/Clients';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { Tasks } from './pages/Tasks';
import { ActivityTracker } from './pages/ActivityTracker';
import { Assets } from './pages/Assets';
import { AssetDetail } from './pages/AssetDetail';

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

        {/* Projects Module (Live) */}
        <Route
          path="projects"
          element={
            <ProtectedRoute requiredPermission={['project.read', 'project.readOwn']}>
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="projects/:id"
          element={
            <ProtectedRoute requiredPermission={['project.read', 'project.readOwn']}>
              <ProjectDetail />
            </ProtectedRoute>
          }
        />

        {/* Tasks Module (Live) */}
        <Route
          path="tasks"
          element={
            <ProtectedRoute requiredPermission={['task.read', 'task.readOwn']}>
              <Tasks />
            </ProtectedRoute>
          }
        />

        {/* Clients Module (Live) */}
        <Route
          path="clients"
          element={
            <ProtectedRoute requiredPermission="client.read">
              <Clients />
            </ProtectedRoute>
          }
        />

        {/* Activity Tracker Module (Live) */}
        <Route
          path="tracker"
          element={
            <ProtectedRoute
              requiredPermission={[
                'activity.logOwn',
                'activity.readOwn',
                'activity.readTeam',
                'activity.readAll',
              ]}
            >
              <ActivityTracker />
            </ProtectedRoute>
          }
        />

        {/* Assets Module (Live) */}
        <Route
          path="assets"
          element={
            <ProtectedRoute requiredPermission={['asset.read', 'asset.readOwn']}>
              <Assets />
            </ProtectedRoute>
          }
        />
        <Route
          path="assets/:id"
          element={
            <ProtectedRoute requiredPermission={['asset.read', 'asset.readOwn']}>
              <AssetDetail />
            </ProtectedRoute>
          }
        />

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
