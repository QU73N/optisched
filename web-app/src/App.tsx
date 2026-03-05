import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import PricingPage from './pages/PricingPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminManageUsers from './pages/admin/AdminManageUsers';
import ScheduleManagement from './pages/admin/ScheduleManagement';
import DataManagement from './pages/admin/DataManagement';
import ConflictsAlerts from './pages/admin/ConflictsAlerts';
import ConstraintSettings from './pages/admin/ConstraintSettings';
import Analytics from './pages/admin/Analytics';
import ScheduleViews from './pages/admin/ScheduleViews';
import CommunicationHub from './pages/shared/CommunicationHub';
import AuditLog from './pages/admin/AuditLog';
import ScheduleEditor from './pages/admin/ScheduleEditor';
import AppSettings from './pages/shared/AppSettings';

import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherSchedule from './pages/teacher/TeacherSchedule';
import TeacherPreferences from './pages/teacher/TeacherPreferences';
import StudentDashboard from './pages/student/StudentDashboard';
import StudentSchedule from './pages/student/StudentSchedule';
import './index.css';

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { session, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading OptiSched...</p>
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={`/${role}`} replace />;
  }
  return <>{children}</>;
};

// Redirect based on role
const RoleRedirect: React.FC = () => {
  const { role, isLoading, session } = useAuth();
  if (isLoading) return <div className="loading-screen"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;
  if (!session) return <Navigate to="/login" replace />;

  // Map all admin sub-roles to /admin
  const adminRoles = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];
  const basePath = adminRoles.includes(role || '') ? 'admin' : (role || 'student');
  return <Navigate to={`/${basePath}`} replace />;
};

// Login guard - redirect if already logged in
const LoginGuard: React.FC = () => {
  const { session, role, isLoading } = useAuth();
  if (isLoading) return <div className="loading-screen"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;
  if (session && role) {
    const adminRoles = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];
    const basePath = adminRoles.includes(role) ? 'admin' : role;
    return <Navigate to={`/${basePath}`} replace />;
  }
  return <LoginPage />;
};



function App() {
  const adminRoles = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginGuard />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Root redirect */}
          <Route path="/" element={<RoleRedirect />} />

          {/* Admin routes - accessible by all admin sub-roles */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={adminRoles}><Layout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminManageUsers />} />
            <Route path="schedules" element={<ScheduleManagement />} />
            <Route path="data" element={<DataManagement />} />
            <Route path="conflicts" element={<ConflictsAlerts />} />
            <Route path="constraints" element={<ConstraintSettings />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="views" element={<ScheduleViews />} />
            <Route path="messages" element={<CommunicationHub />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="editor" element={<ScheduleEditor />} />
            <Route path="settings" element={<AppSettings />} />

          </Route>

          {/* Teacher routes */}
          <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><Layout /></ProtectedRoute>}>
            <Route index element={<TeacherDashboard />} />
            <Route path="schedule" element={<TeacherSchedule />} />
            <Route path="preferences" element={<TeacherPreferences />} />
            <Route path="chat" element={<CommunicationHub />} />
            <Route path="settings" element={<AppSettings />} />
          </Route>

          {/* Student routes */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><Layout /></ProtectedRoute>}>
            <Route index element={<StudentDashboard />} />
            <Route path="schedule" element={<StudentSchedule />} />
            <Route path="settings" element={<AppSettings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
