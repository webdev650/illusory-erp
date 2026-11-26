import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { ChangePassword } from './pages/ChangePassword';
import { Home } from './pages/Home';
import { HRMS } from './pages/HRMS';
import { HRMSDashboard } from './pages/HRMSDashboard';
import { Warnings } from './pages/Warnings';
import { Performance } from './pages/Performance';
import { LettersAndDocuments } from './pages/LettersAndDocuments';
import { VerifyDocument } from './pages/VerifyDocument';
import { ModuleComingSoon } from './pages/ModuleComingSoon';
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
import ImportEmployees from './pages/ImportEmployees';
import AttendanceCalendar from './pages/attendance/AttendanceCalendar';
import ManageLogs from './pages/attendance/ManageLogs';
import LogRegularization from './pages/attendance/LogRegularization';
import ApplyLeave from './pages/attendance/ApplyLeave';
import ApplyRemoteWork from './pages/attendance/ApplyRemoteWork';
import ApplyPartialDay from './pages/attendance/ApplyPartialDay';
import ApplyCompOff from './pages/attendance/ApplyCompOff';
import ManageBulkPunch from './pages/attendance/ManageBulkPunch';
import ShiftRoster from './pages/attendance/ShiftRoster';
import LeaveBalanceSettlement from './pages/attendance/LeaveBalanceSettlement';
import CutoverReadiness from './pages/attendance/CutoverReadiness';
import AttendanceReports from './pages/attendance/AttendanceReports';
import PolicyConfirmation from './pages/attendance/PolicyConfirmation';

export const App = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/verify/:token" element={<VerifyDocument />} />

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

        {/* HRMS Module (Two-Level Sub-pages) */}
        <Route
          path="hrms"
          element={
            <ProtectedRoute requiredPermission={['hrms.dashboard.view', 'employee.read']}>
              <HRMSDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/dashboard"
          element={
            <ProtectedRoute requiredPermission="hrms.dashboard.view">
              <HRMSDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/employees"
          element={
            <ProtectedRoute requiredPermission="employee.read">
              <HRMS />
            </ProtectedRoute>
          }
        />
        {/* HRMS Attendance Sub-menu Routes */}
        <Route
          path="hrms/attendance"
          element={
            <ProtectedRoute requiredPermission="attendance.read">
              <AttendanceCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/calendar"
          element={
            <ProtectedRoute requiredPermission="attendance.read">
              <AttendanceCalendar />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/manage-logs"
          element={
            <ProtectedRoute requiredPermission={['attendance.manage', 'hr.access', 'employee.read']}>
              <ManageLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/regularization"
          element={
            <ProtectedRoute>
              <LogRegularization />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/leave"
          element={
            <ProtectedRoute>
              <ApplyLeave />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/remote-work"
          element={
            <ProtectedRoute>
              <ApplyRemoteWork />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/partial-day"
          element={
            <ProtectedRoute>
              <ApplyPartialDay />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/comp-off"
          element={
            <ProtectedRoute>
              <ApplyCompOff />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/bulk-logs"
          element={
            <ProtectedRoute requiredPermission={['attendance.manage', 'hr.access', 'employee.read']}>
              <ManageBulkPunch />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/roster"
          element={
            <ProtectedRoute requiredPermission={['attendance.read', 'shift.manage', 'employee.read']}>
              <ShiftRoster />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/settlement"
          element={
            <ProtectedRoute requiredPermission={['leave.settle', 'hr.access']}>
              <LeaveBalanceSettlement />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/cutover-readiness"
          element={
            <ProtectedRoute requiredPermission={['leave.settle', 'hr.access']}>
              <CutoverReadiness />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/reports"
          element={
            <ProtectedRoute requiredPermission={['reports.view', 'attendance.manage', 'hr.access']}>
              <AttendanceReports />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/attendance/policy-confirmation"
          element={
            <ProtectedRoute requiredPermission={['hr.access', 'attendance.manage', 'system.manage']}>
              <PolicyConfirmation />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/approvals"
          element={
            <ProtectedRoute requiredPermission="approval.read">
              <Approvals />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/letters"
          element={
            <ProtectedRoute requiredPermission={['document.manage', 'letter.view', 'letter.generate']}>
              <LettersAndDocuments />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/warnings"
          element={
            <ProtectedRoute requiredPermission="hr.access">
              <Warnings />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/performance"
          element={
            <ProtectedRoute requiredPermission="performance.viewOwn">
              <Performance />
            </ProtectedRoute>
          }
        />
        <Route
          path="hrms/engage"
          element={
            <ModuleComingSoon
              title="Engage & Studio Culture"
              description="Pulse surveys, peer recognition, studio shoutouts, and team culture tracking."
              features={[
                'Voluntary employee pulse surveys and sentiment analytics',
                'Peer-to-peer appreciation badges and public shoutouts',
                'Company townhall Q&A and cultural event voting',
              ]}
            />
          }
        />
        <Route
          path="hrms/training"
          element={
            <ModuleComingSoon
              title="Training & Development"
              description="Skill development matrices, course certifications, and progression roadmaps."
              features={[
                'Design, frontend, and engineering training curriculums',
                'Certifications repository and automatic renewal alerts',
                'Senior mentorship pairing and 1-on-1 development tracking',
              ]}
            />
          }
        />
        <Route
          path="hrms/performance"
          element={
            <ModuleComingSoon
              title="Performance Management"
              description="Quarterly OKRs, 360-degree reviews, and annual appraisal cycles."
              features={[
                'Quarterly OKR and project KPI tracking',
                'Self-appraisals, peer reviews, and manager scorecards',
                'Objective compensation and promotion recommendations',
              ]}
            />
          }
        />
        <Route
          path="hrms/import"
          element={
            <ProtectedRoute requiredPermission="employee.import">
              <ImportEmployees />
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
