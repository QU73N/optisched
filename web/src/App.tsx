import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
const AdminDashboardDispatcher = lazy(() => import('./pages/admin/AdminDashboardDispatcher'));
const AdminManageUsers = lazy(() => import('./pages/admin/AdminManageUsers'));
const AddUser = lazy(() => import('./pages/admin/AddUser'));
const ScheduleManagement = lazy(() => import('./pages/admin/ScheduleManagement'));
const DataManagement = lazy(() => import('./pages/admin/DataManagement'));
const PriorityConfiguration = lazy(() => import('./pages/admin/PriorityConfiguration'));
const SharingManagement = lazy(() => import('./pages/admin/SharingManagement'));
const BreakTimes = lazy(() => import('./pages/admin/BreakTimes'));
const ScheduleLocking = lazy(() => import('./pages/admin/ScheduleLocking'));
const ConflictsAlerts = lazy(() => import('./pages/admin/ConflictsAlerts'));
const ConflictVersionSelector = lazy(() => import('./pages/admin/ConflictVersionSelector'));
const ConstraintSettings = lazy(() => import('./pages/admin/ConstraintSettings'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const ScheduleVersions = lazy(() => import('./pages/admin/ScheduleVersions'));
const CommunicationHub = lazy(() => import('./pages/shared/CommunicationHub'));
const GroupChats = lazy(() => import('./pages/shared/GroupChats'));
const AuditLogLegacy = lazy(() => import('./pages/admin/AuditLog'));
const ScheduleGenerate = lazy(() => import('./pages/admin/ScheduleGenerate'));
const FacultyHub = lazy(() => import('./pages/admin/FacultyHub'));
const AIScheduleChat = lazy(() => import('./pages/admin/AIScheduleChat'));
const AdminScheduleTasks = lazy(() => import('./pages/admin/AdminScheduleTasks'));
const AppSettings = lazy(() => import('./pages/shared/AppSettings'));
const OptiBotPage = lazy(() => import('./pages/shared/OptiBotPage'));
const TeacherToTeacherChat = lazy(() => import('./pages/teacher/TeacherToTeacherChat'));
const TeacherChatHub = lazy(() => import('./pages/teacher/TeacherChatHub'));

// New v1.2 governance & per-role pages (lazy-loaded for code splitting)
const SystemRules = lazy(() => import('./pages/admin/SystemRules'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const UserActivityPage = lazy(() => import('./pages/admin/UserActivityPage'));
const SessionsPage = lazy(() => import('./pages/admin/SessionsPage'));
const ApprovalsPage = lazy(() => import('./pages/admin/ApprovalsPage'));
const AnnouncementsPage = lazy(() => import('./pages/shared/AnnouncementsPage'));
const AdminBackup = lazy(() => import('./pages/admin/AdminBackup'));
const AdminOverride = lazy(() => import('./pages/admin/AdminOverride'));
const AdminFeatureFlags = lazy(() => import('./pages/admin/AdminFeatureFlags'));
const HealthPage = lazy(() => import('./pages/admin/HealthPage'));
const VersionManager = lazy(() => import('./pages/admin/VersionManager'));

const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TeacherSchedule = lazy(() => import('./pages/teacher/TeacherSchedule'));
const TeacherPreferences = lazy(() => import('./pages/teacher/TeacherPreferences'));
const TeacherWorkload = lazy(() => import('./pages/teacher/TeacherWorkload'));
const TeacherRequests = lazy(() => import('./pages/teacher/TeacherRequests'));
const TeacherSections = lazy(() => import('./pages/teacher/TeacherSections'));

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const StudentSchedule = lazy(() => import('./pages/student/StudentSchedule'));
const StudentUpcoming = lazy(() => import('./pages/student/StudentUpcoming'));
const StudentSection = lazy(() => import('./pages/student/StudentSection'));
const StudentHelp = lazy(() => import('./pages/student/StudentHelp'));
import './index.css';

// Protected route wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { session, role, roles, isLoading } = useAuth();

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
  // Multi-role: check if ANY of the user's roles matches the allowedRoles
  if (allowedRoles && role) {
    const userRoles = roles.length > 0 ? roles : [role];
    const hasAccess = userRoles.some(r => allowedRoles.includes(r));
    if (!hasAccess) {
      return <Navigate to={`/${role}`} replace />;
    }
  }
  return <>{children}</>;
};

// Landing page guard - redirect to dashboard if already logged in
// Used for both root path (/) and /login route
const LandingGuard: React.FC = () => {
  const { session, role, roles, isLoading } = useAuth();
  if (isLoading) return <div className="loading-screen"><div className="spinner" style={{ width: 40, height: 40 }} /></div>;
  if (session && role) {
    const adminRoles = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];
    const allRoles = roles.length > 0 ? roles : [role];
    const hasAdmin = allRoles.some(r => adminRoles.includes(r));
    const basePath = role === 'teacher' ? 'teacher' : (hasAdmin ? 'admin' : role);
    return <Navigate to={`/${basePath}`} replace />;
  }
  return <LandingPage />;
};



function App() {
  const adminRoles = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];

  return (
    <BrowserRouter>
      <AuthProvider>
        <UserPreferencesProvider>
          <ToastProvider>
            <Routes>
          {/* Public */}
          <Route path="/" element={<LandingGuard />} />
          <Route path="/login" element={<LandingGuard />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Admin routes - accessible by all admin sub-roles */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={adminRoles}><Layout /></ProtectedRoute>}>
            <Route index element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AdminDashboardDispatcher /></Suspense>} />
            <Route path="broadcasts" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AnnouncementsPage /></Suspense>} />
            <Route path="users" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AdminManageUsers /></Suspense>} />
            <Route path="users/add" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AddUser /></Suspense>} />
            <Route path="schedules" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><Navigate to="versions" replace /></Suspense>} />
            <Route path="schedules/current" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ScheduleManagement /></Suspense>} />
            <Route path="schedules/versions" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ScheduleVersions /></Suspense>} />
            <Route path="data" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><DataManagement /></Suspense>} />
            <Route path="priority" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><PriorityConfiguration /></Suspense>} />
            <Route path="sharing" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><SharingManagement /></Suspense>} />
            <Route path="break-times" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><BreakTimes /></Suspense>} />
            <Route path="locking" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ScheduleLocking /></Suspense>} />
            <Route path="conflicts" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ConflictVersionSelector /></Suspense>} />
            <Route path="conflicts/version/:versionId" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ConflictsAlerts /></Suspense>} />
            <Route path="constraints" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ConstraintSettings /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><Analytics /></Suspense>} />
            <Route path="messages" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><CommunicationHub /></Suspense>} />
            <Route path="group-chats" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><GroupChats /></Suspense>} />
            <Route path="audit" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AuditLogPage /></Suspense>} />
            <Route path="audit-legacy" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AuditLogLegacy /></Suspense>} />
            <Route path="generate" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ScheduleGenerate /></Suspense>} />
            <Route path="faculty" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><FacultyHub /></Suspense>} />
            <Route path="ai-chat" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AIScheduleChat /></Suspense>} />
            <Route path="tasks" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AdminScheduleTasks /></Suspense>} />
            <Route path="optibot" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><OptiBotPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AppSettings /></Suspense>} />

            {/* v1.2 governance + approval pages */}
            <Route path="rules" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><SystemRules /></Suspense>} />
            <Route path="activity" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><UserActivityPage /></Suspense>} />
            <Route path="sessions" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><SessionsPage /></Suspense>} />
            <Route path="approvals" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ApprovalsPage /></Suspense>} />
            <Route path="announcements" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AnnouncementsPage /></Suspense>} />

            {/* Schedule Admin extras */}
            <Route path="history" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ScheduleManagement /></Suspense>} />
            <Route path="requests" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><ApprovalsPage /></Suspense>} />

            {/* Schedule Manager extras */}
            <Route path="templates" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><DataManagement /></Suspense>} />

            {/* System Admin extras (placeholders — reuse existing surfaces for now) */}
            <Route path="health" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><HealthPage /></Suspense>} />
            <Route path="lifecycle" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AdminManageUsers /></Suspense>} />
            <Route path="structure" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><DataManagement /></Suspense>} />
            <Route path="branding" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AppSettings /></Suspense>} />

            {/* Power Admin extras */}
            <Route path="backup" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AdminBackup /></Suspense>} />
            <Route path="override" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AdminOverride /></Suspense>} />
            <Route path="flags" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AdminFeatureFlags /></Suspense>} />
            <Route path="versions" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><VersionManager /></Suspense>} />
          </Route>

          {/* Teacher routes - also accessible by multi-role users with teacher role */}
          <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher', 'schedule_admin', 'schedule_manager']}><Layout /></ProtectedRoute>}>
            <Route index element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherDashboard /></Suspense>} />
            <Route path="schedule" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherSchedule /></Suspense>} />
            <Route path="workload" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherWorkload /></Suspense>} />
            <Route path="preferences" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherPreferences /></Suspense>} />
            <Route path="requests" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherRequests /></Suspense>} />
            <Route path="sections" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherSections /></Suspense>} />
            <Route path="announcements" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AnnouncementsPage /></Suspense>} />
            <Route path="chat" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherChatHub /></Suspense>} />
            <Route path="group-chats" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><GroupChats /></Suspense>} />
            <Route path="peer-chat" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><TeacherToTeacherChat /></Suspense>} />
            <Route path="optibot" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><OptiBotPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AppSettings /></Suspense>} />
          </Route>

          {/* Student routes */}
          <Route path="/student" element={<ProtectedRoute allowedRoles={['student']}><Layout /></ProtectedRoute>}>
            <Route index element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><StudentDashboard /></Suspense>} />
            <Route path="schedule" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><StudentSchedule /></Suspense>} />
            <Route path="upcoming" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><StudentUpcoming /></Suspense>} />
            <Route path="section" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><StudentSection /></Suspense>} />
            <Route path="announcements" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AnnouncementsPage /></Suspense>} />
            <Route path="help" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><StudentHelp /></Suspense>} />
            <Route path="optibot" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><OptiBotPage /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<div className="dash-loading-center"><div className="spin" style={{fontSize: 24}}>⟳</div><div style={{marginTop: 8}}>Loading...</div></div>}><AppSettings /></Suspense>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </ToastProvider>
        </UserPreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
