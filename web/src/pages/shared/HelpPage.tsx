import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, User,
    Sparkles, AlertTriangle, Database,
    CheckCircle, XCircle, Shield, GitBranch,
    Gauge, FileCheck, FolderTree, KeyRound,
    Workflow, UserCog,
    GraduationCap,
    History, RefreshCw,
    Menu, AlertCircle,
    Sun, Moon, TrendingUp, Zap, Settings, Layers, PanelLeft, X, LogOut
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_ROLES, ROLE_DISPLAY_NAMES, hasAnyRole } from '../../types/database';
import HelpSidebar from '../../components/HelpSidebar';
import FloatingOptiBot from '../../components/FloatingOptiBot';
import OptiBotSiderail from '../../components/OptiBotSiderail';
import './HelpPage.css';

const HelpPage: React.FC = () => {
    const { profile, role, roles, signOut } = useAuth();
    const navigate = useNavigate();
    const [theme, setTheme] = useState<string>(() =>
        (typeof window !== 'undefined' && localStorage.getItem('optisched-theme')) || 'light'
    );
    const [siderailOpen, setSiderailOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState<string>('getting-started');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const handleSignOut = useCallback(async () => {
        await signOut();
        navigate('/login');
    }, [signOut, navigate]);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('optisched-theme', newTheme);
        document.documentElement.setAttribute('data-transitioning-theme', '');
        document.documentElement.setAttribute('data-theme', newTheme);
        setTimeout(() => {
            document.documentElement.removeAttribute('data-transitioning-theme');
        }, 450);
    };

    const isAnyAdmin = hasAnyRole(roles, ADMIN_ROLES);

    const getRoleBadgeClass = () => {
        if (role === 'power_admin') return 'badge badge-admin';
        if (role === 'admin') return 'badge badge-admin';
        if (role === 'schedule_admin') return 'badge badge-admin';
        if (role === 'schedule_manager') return 'badge badge-admin';
        if (role === 'teacher') return 'badge badge-teacher';
        return 'badge badge-student';
    };

    const SHORT_NAMES: Record<string, string> = {
        'Schedule Administrator': 'Sched Admin',
        'Schedule Manager': 'Sched Mgr',
        'System Administrator': 'Sys Admin',
        'Power Admin': 'Power Admin',
        'Teacher': 'Teacher',
        'Student': 'Student',
    };
    const displayRole = roles.length > 1
        ? roles.map(r => SHORT_NAMES[ROLE_DISPLAY_NAMES[r]] || ROLE_DISPLAY_NAMES[r] || r).join(' · ').toUpperCase()
        : role ? (ROLE_DISPLAY_NAMES[role] || role).toUpperCase() : 'USER';

    return (
        <div className="layout">
            <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                <button className="mobile-close-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                    <Menu size={18} />
                </button>
                <HelpSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

                <div className="sidebar-footer">
                    {profile ? (
                        <>
                            <div className="sidebar-user">
                                <div className="sidebar-avatar">
                                    {profile.full_name
                                        ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)
                                        : '?'}
                                </div>
                                <div className="sidebar-user-info">
                                    <span className="sidebar-user-name">{profile.full_name}</span>
                                    <button
                                        className={`${getRoleBadgeClass()} badge-sm`}
                                        title={displayRole}
                                    >
                                        {displayRole}
                                    </button>
                                </div>
                            </div>
                            <button className="sidebar-logout" onClick={handleSignOut} aria-label="Sign Out">
                                <LogOut size={18} />
                            </button>
                        </>
                    ) : (
                        <div className="sidebar-user-placeholder">
                            <div className="sidebar-avatar-placeholder">
                                <User size={24} />
                            </div>
                            <div className="sidebar-user-info">
                                <span className="sidebar-user-name">Not signed in</span>
                                <button
                                    className="badge badge-sm"
                                    onClick={() => navigate('/login')}
                                >
                                    Sign in
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            <div className={`sidebar-overlay ${mobileMenuOpen ? 'mobile-open' : ''}`} onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />

            <header className="topbar">
                <div className="topbar-left">
                    <button className="topbar-btn mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle mobile menu">
                        <Menu size={18} />
                    </button>
                    <div className="sidebar-logo">
                        <img src={theme === 'light' ? '/logo.png' : '/logo-white.png'} alt="OptiSched" />
                    </div>
                    <div className="sidebar-brand">
                        <h2>OptiSched</h2>
                        <span>Help Center</span>
                    </div>
                </div>
                <div className="topbar-right">
                    <button className="topbar-btn" onClick={() => setSiderailOpen(!siderailOpen)} aria-label="Toggle siderail">
                        <PanelLeft size={18} />
                    </button>
                    <button className="topbar-btn" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button className="topbar-btn" onClick={() => navigate(isAnyAdmin ? '/admin' : `/${role}`)} aria-label="Back to dashboard">
                        <X size={18} />
                    </button>
                </div>
            </header>

            <div className="content-area">
                <div className="main-wrapper help-main-wrapper">
                    <main className="main-content help-main">
                {activeSection === 'getting-started' && (
                    <>
                <section className="help-section" id="getting-started">
                    <div className="help-section-header">
                        <h2>Getting Started</h2>
                        <p>Quick introduction to OptiSched for new users</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <LayoutDashboard size={28} />
                            </div>
                            <h3>What is OptiSched?</h3>
                            <p>
                                OptiSched is a comprehensive academic scheduling system that helps institutions manage class schedules, teacher assignments, room allocations, and student enrollments. The system is designed to be a serious institutional tool that feels modern and professional while meeting academic needs.
                            </p>
                            <div className="help-card-features">
                                <span className="help-card-feature">Conflict-free schedules</span>
                                <span className="help-card-feature">Role-based access</span>
                                <span className="help-card-feature">Version control</span>
                                <span className="help-card-feature">AI assistance</span>
                            </div>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <KeyRound size={24} />
                            </div>
                            <h3>First-Time Login</h3>
                            <p>
                                Navigate to your institution's OptiSched URL, enter your email and password, and you will be automatically routed to the dashboard appropriate for your role.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Menu size={24} />
                            </div>
                            <h3>Navigation</h3>
                            <p>
                                Use the sidebar to access different features. The top navigation bar shows notifications, profile settings, and logout options.
                            </p>
                        </div>
                    </div>
                </section>
                    </>
                )}

                {activeSection === 'user-roles' && (
                    <>
                <section className="help-section" id="user-roles">
                    <div className="help-section-header">
                        <h2>User Roles</h2>
                        <p>Understanding permissions and responsibilities for each role</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card help-card-wide role-card power-admin">
                            <div className="role-badge power-admin">
                                <Shield size={20} />
                                Power Admin
                            </div>
                            <h3>Emergency System Authority</h3>
                            <p>
                                Full system authority with override capabilities, audit log access, and impersonation rights. Intended for security incidents and system recovery only.
                            </p>
                            <div className="role-permissions">
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Create and manage all user accounts</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Override any system restriction</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Access all audit logs</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Impersonate other users</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Approve or reject schedules</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Delete schedules (soft deletion)</span>
                                </div>
                            </div>
                            <div className="role-limitations">
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot delete their own account</span>
                                </div>
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot bypass database integrity</span>
                                </div>
                            </div>
                        </div>

                        <div className="help-card help-card-wide role-card system-admin">
                            <div className="role-badge system-admin">
                                <UserCog size={20} />
                                System Admin
                            </div>
                            <h3>Access Governance & System Health</h3>
                            <p>
                                Manages access governance, system rules, and troubleshooting. Creates accounts, configures the Permission Rules Engine, and monitors system health.
                            </p>
                            <div className="role-permissions">
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Create and manage user accounts</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Assign roles (except Power Admin)</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Configure permission rules</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Assign schedule managers to departments</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Monitor system health</span>
                                </div>
                            </div>
                            <div className="role-limitations">
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot approve schedules</span>
                                </div>
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot create Power Admin accounts</span>
                                </div>
                            </div>
                        </div>

                        <div className="help-card help-card-wide role-card schedule-admin">
                            <div className="role-badge schedule-admin">
                                <FileCheck size={20} />
                                Schedule Admin
                            </div>
                            <h3>Schedule Admin</h3>
                            <p>
                                Manages the approval workflow for schedules. Can approve or reject submissions and edit any schedule directly.
                            </p>
                            <div className="role-permissions">
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Approve or reject schedule submissions</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Edit any schedule directly</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>View all schedules</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Access version history</span>
                                </div>
                            </div>
                            <div className="role-limitations">
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot manage user accounts</span>
                                </div>
                            </div>
                        </div>

                        <div className="help-card help-card-wide role-card schedule-manager">
                            <div className="role-badge schedule-manager">
                                <Sparkles size={20} />
                                Schedule Manager
                            </div>
                            <h3>Schedule Manager</h3>
                            <p>
                                Creates and manages schedules. Can generate automated schedules, manually edit them, and submit for approval.
                            </p>
                            <div className="role-permissions">
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Create and manage teachers, rooms, subjects, sections</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Generate automated schedules</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Manually edit schedules</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Submit schedules for approval</span>
                                </div>
                            </div>
                            <div className="role-limitations">
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot approve other managers' schedules</span>
                                </div>
                            </div>
                        </div>

                        <div className="help-card help-card-wide role-card teacher">
                            <div className="role-badge teacher">
                                <GraduationCap size={20} />
                                Teacher
                            </div>
                            <h3>Teacher</h3>
                            <p>
                                Views their own schedule and sets availability preferences. Can submit change requests.
                            </p>
                            <div className="role-permissions">
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>View approved schedule</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>View workload statistics</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Set availability preferences</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Submit schedule change requests</span>
                                </div>
                            </div>
                            <div className="role-limitations">
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot edit schedules directly</span>
                                </div>
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot view other teachers' schedules</span>
                                </div>
                            </div>
                        </div>

                        <div className="help-card help-card-wide role-card student">
                            <div className="role-badge student">
                                <Users size={20} />
                                Student
                            </div>
                            <h3>Student</h3>
                            <p>
                                Views their personal class schedule and section-level schedules. Can read announcements.
                            </p>
                            <div className="role-permissions">
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>View personal class schedule</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>View section-level schedules</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Check upcoming classes</span>
                                </div>
                                <div className="role-permission">
                                    <CheckCircle size={16} />
                                    <span>Read announcements</span>
                                </div>
                            </div>
                            <div className="role-limitations">
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot edit schedules</span>
                                </div>
                                <div className="role-limitation">
                                    <XCircle size={16} />
                                    <span>Cannot view other students' schedules</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                    </>
                )}

                {activeSection === 'schedule-engine' && (
                    <>
                <section className="help-section" id="schedule-engine">
                    <div className="help-section-header">
                        <h2>Schedule Engine</h2>
                        <p>How the automated scheduling system works</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <Sparkles size={28} />
                            </div>
                            <h3>How the Engine Works</h3>
                            <p>
                                The OptiSched scheduling engine is a hybrid system that combines deterministic logic, constrained search, and local optimization. It follows four core principles: hard constraints are never violated, soft constraints are optimized whenever possible, the hardest items are placed first, and repairs are done intelligently instead of restarting blindly.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <CheckCircle size={24} />
                            </div>
                            <h3>Phase 1: Scope Definition</h3>
                            <p>
                                Defines what the engine can touch - selected sections, teachers, rooms, subjects, or the full institution. Also identifies whether it's a draft, replacement, partial repair, or full rebuild.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Database size={24} />
                            </div>
                            <h3>Phase 2: Data Preparation</h3>
                            <p>
                                Normalizes all records into scheduler-ready structures. Teachers become availability windows and qualified subject lists. Rooms become capacity and type information. Sections become student size and hierarchy paths.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Shield size={24} />
                            </div>
                            <h3>Phase 3: Constraint Classification</h3>
                            <p>
                                Separates constraints into hard (absolute rules like no teacher overlap), soft (flexible goals like balanced load), and preference (intermediate rules like preferred rooms).
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <TrendingUp size={24} />
                            </div>
                            <h3>Phase 4: Priority Ranking</h3>
                            <p>
                                Determines which sessions are hardest to place based on legal slot count, teacher scarcity, room scarcity, special room dependency, and section priority. Hardest sessions are placed first.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <FolderTree size={24} />
                            </div>
                            <h3>Phase 5: Domain Construction</h3>
                            <p>
                                Builds candidate domains for every session before placement. Includes valid days, time blocks, teachers, and rooms. Invalid options are pruned early to save time.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Workflow size={24} />
                            </div>
                            <h3>Phase 6: Initial Construction</h3>
                            <p>
                                Generates a feasible base schedule using greedy but intelligent placement. Places hardest sessions first using least-constraining-value logic to leave room for remaining sessions.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <GitBranch size={24} />
                            </div>
                            <h3>Phase 7: Forward Checking</h3>
                            <p>
                                After each placement, immediately updates remaining domains. If a teacher is assigned, all conflicting teacher slots are removed. Thinks ahead continuously.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <RefreshCw size={24} />
                            </div>
                            <h3>Phase 8: Repair & Backtracking</h3>
                            <p>
                                If stuck, tries repair first - moving lower-priority sessions to free space for blocked sessions. Supports single-session moves, teacher swaps, room swaps, and time shifts.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Zap size={24} />
                            </div>
                            <h3>Phase 9: Randomized Search</h3>
                            <p>
                                Uses controlled randomness to explore alternative valid schedule shapes. Each attempt uses a seed for reproducibility. Helps escape local optima without losing determinism.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Gauge size={24} />
                            </div>
                            <h3>Phase 10: Optimization</h3>
                            <p>
                                Once feasible, improves the schedule by optimizing soft constraints. Scores teacher balance, section compactness, room movement, special room allocation, and time preferences.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Settings size={24} />
                            </div>
                            <h3>Phase 11: Institutional Options</h3>
                            <p>
                                Handles special cases like split-session support, compressed weeks, staggered breaks, shared teachers, deloaded teachers, and special room fallback policies.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <AlertTriangle size={24} />
                            </div>
                            <h3>Phase 12: Impossible Schedules</h3>
                            <p>
                                Detects when schedules cannot be solved and identifies why - not enough rooms, not enough teachers, too many required hours, or breaks too restrictive. Provides actionable options.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <History size={24} />
                            </div>
                            <h3>Phase 13: Versioning</h3>
                            <p>
                                Every generated result is versioned with input configuration, scope, seed, priority settings, constraint settings, attempt scores, and final schedule. Enables reproducibility and auditability.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Layers size={24} />
                            </div>
                            <h3>Phase 14: Partial Regeneration</h3>
                            <p>
                                Supports regenerating only one section, one teacher's schedule, one room's usage, or one subject. Preserves everything outside the selected scope to reduce disruption.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <FileCheck size={24} />
                            </div>
                            <h3>Phase 15: Output & Review</h3>
                            <p>
                                Produces the final timetable, placed and unplaced sessions with reasons, hard constraint compliance status, soft constraint score breakdown, repair summary, and version information.
                            </p>
                        </div>
                    </div>
                </section>
                    </>
                )}

                {activeSection === 'key-features' && (
                    <>
                <section className="help-section" id="key-features">
                    <div className="help-section-header">
                        <h2>Key Features</h2>
                        <p>Core capabilities of the OptiSched platform</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <Shield size={28} />
                            </div>
                            <h3>Power Admin Guide</h3>
                            <p>
                                <strong>What They Can Do:</strong> Create and manage all user accounts, assign any role, override system restrictions, access audit logs, impersonate users, approve schedules, and delete schedules.
                            </p>
                            <ul>
                                <li><strong>User Management:</strong> Create users, assign roles, reset passwords, deactivate accounts</li>
                                <li><strong>System Rules:</strong> Configure permission rules, view audit logs, monitor system health</li>
                                <li><strong>Emergency Recovery:</strong> Lock down user access, check version history, use override authority</li>
                            </ul>
                            <div className="help-card-note">
                                <AlertCircle size={16} />
                                <span>Power Admins cannot delete their own account and cannot bypass database integrity constraints.</span>
                            </div>
                        </div>

                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <UserCog size={28} />
                            </div>
                            <h3>System Admin Guide</h3>
                            <p>
                                <strong>What They Can Do:</strong> Create and manage user accounts (except Power Admin), configure permission rules, assign schedule managers to departments, monitor system health, and view audit logs.
                            </p>
                            <ul>
                                <li><strong>User Account Management:</strong> Create standard users, manage access, reset passwords, reassign roles</li>
                                <li><strong>Permission Rules Engine:</strong> Configure rules like teachers_can_see_student_schedules, schedule_managers_can_edit_without_approval</li>
                                <li><strong>System Health:</strong> Monitor active users, login activity, performance indicators, error rates</li>
                            </ul>
                            <div className="help-card-note">
                                <AlertCircle size={16} />
                                <span>System Admins cannot approve schedules, create Power Admin accounts, or impersonate users.</span>
                            </div>
                        </div>

                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <FileCheck size={28} />
                            </div>
                            <h3>Schedule Admin Guide</h3>
                            <p>
                                <strong>What They Can Do:</strong> Approve or reject schedule submissions, edit any schedule directly, view all schedules, manage approval workflow, access version history, and manage break times.
                            </p>
                            <ul>
                                <li><strong>Approval Workflow:</strong> Review pending requests, check for conflicts, verify teacher preferences, approve or reject with notes</li>
                                <li><strong>Direct Editing:</strong> Edit teacher assignments, room allocations, time slots, resolve conflicts</li>
                                <li><strong>Break Times:</strong> Configure lunch, recess, assembly, and other break times by day and semester</li>
                            </ul>
                            <div className="help-card-note">
                                <AlertCircle size={16} />
                                <span>Schedule Admins cannot manage user accounts or modify system rules.</span>
                            </div>
                        </div>

                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <Sparkles size={28} />
                            </div>
                            <h3>Schedule Manager Guide</h3>
                            <p>
                                <strong>What They Can Do:</strong> Create and manage teachers, rooms, subjects, sections, generate schedules, manually edit schedules, submit for approval, and manage teacher preferences.
                            </p>
                            <ul>
                                <li><strong>Data Management:</strong> Add teachers with availability, add rooms with capacity, add subjects with requirements, add sections with hierarchy</li>
                                <li><strong>Generation:</strong> Use automated generator with priority strategy, conflict resolution, and constraint settings</li>
                                <li><strong>Priority Configuration:</strong> Set resource priorities (higher weight = more preferred slots)</li>
                            </ul>
                            <div className="help-card-note">
                                <AlertCircle size={16} />
                                <span>Schedule Managers cannot manage user accounts, modify system rules, or approve other managers' schedules.</span>
                            </div>
                        </div>

                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <GraduationCap size={28} />
                            </div>
                            <h3>Teacher Guide</h3>
                            <p>
                                <strong>What They Can Do:</strong> View approved schedule, view workload statistics, set availability preferences, submit schedule change requests, and message administrators.
                            </p>
                            <ul>
                                <li><strong>View Schedule:</strong> See today's classes, weekly schedule, upcoming classes, room assignments</li>
                                <li><strong>Set Preferences:</strong> Set availability by day/time, preferred time range, max classes per day, max consecutive classes</li>
                                <li><strong>Change Requests:</strong> Submit requests for schedule changes with justification</li>
                            </ul>
                            <div className="help-card-note">
                                <AlertCircle size={16} />
                                <span>Teachers cannot edit schedules directly, view other teachers' schedules, or view student schedules (unless permitted by rules).</span>
                            </div>
                        </div>

                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <Users size={28} />
                            </div>
                            <h3>Student Guide</h3>
                            <p>
                                <strong>What They Can Do:</strong> View personal class schedule, view section-level schedules, check upcoming classes, view break times, and read announcements.
                            </p>
                            <ul>
                                <li><strong>View Schedule:</strong> See today's classes, weekly schedule, class locations and times, teacher names (if visible)</li>
                                <li><strong>Section Schedules:</strong> View all sections in your program, understand program structure</li>
                                <li><strong>Break Times:</strong> See institutional breaks, plan study time around breaks</li>
                            </ul>
                            <div className="help-card-note">
                                <AlertCircle size={16} />
                                <span>Students cannot edit schedules, submit change requests, view other students' schedules, or access administrative features.</span>
                            </div>
                        </div>
                    </div>
                </section>
                    </>
                )}

                {activeSection === 'best-practices' && (
                    <>
                <section className="help-section" id="best-practices">
                    <div className="help-section-header">
                        <h2>Best Practices</h2>
                        <p>Recommended workflows and tips for optimal results</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <Shield size={28} />
                            </div>
                            <h3>Data Quality First</h3>
                            <p>Ensure all teacher availability, room capacities, and subject requirements are accurate before generating.</p>
                        </div>
                        <div className="help-card">
                            <div className="help-card-icon">
                                <CheckCircle size={24} />
                            </div>
                            <h3>Start Small</h3>
                            <p>Begin with a single department to validate constraints before scaling to the full institution.</p>
                        </div>
                    </div>
                </section>
                    </>
                )}

                {activeSection === 'troubleshooting' && (
                    <>
                <section className="help-section" id="troubleshooting">
                    <div className="help-section-header">
                        <h2>Troubleshooting</h2>
                        <p>Common issues and how to resolve them</p>
                    </div>
                    <div className="help-troubleshooting">
                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <AlertCircle size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Cannot access a resource</h4>
                                <p>Check your role permissions. Contact your administrator if you believe you should have access.</p>
                            </div>
                        </div>
                    </div>
                </section>
                    </>
                )}
            </main>
                </div>

                <aside className={`siderail ${siderailOpen ? 'siderail-open' : ''}`}>
                    <div className="siderail-content">
                        <div className="siderail-section">
                            <OptiBotSiderail />
                        </div>
                    </div>
                </aside>
            </div>

            <FloatingOptiBot />
        </div>
    );
};

export default HelpPage;
