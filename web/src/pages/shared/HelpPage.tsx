import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, LayoutDashboard, Users,
    BookOpen, MessageSquare, Sparkles, AlertTriangle, Database,
    CheckCircle, XCircle, Bell, Shield, GitBranch,
    Scale, Gauge, FileCheck, FolderTree, Building2, KeyRound,
    Smartphone, Workflow, Eye,
    ShieldCheck, UserCog,
    GraduationCap, ClipboardList,
    History, RefreshCw,
    Menu, Info, AlertCircle,
    Sun, Moon, TrendingUp, Zap, Settings, Layers
} from 'lucide-react';
import './HelpPage.css';

const HelpPage: React.FC = () => {
    const navigate = useNavigate();
    const [theme, setTheme] = useState<string>(() =>
        (typeof window !== 'undefined' && localStorage.getItem('optisched-theme')) || 'light'
    );
    const [activeSection, setActiveSection] = useState<string>('getting-started');

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

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

    const sections = [
        { id: 'getting-started', title: 'Getting Started', icon: LayoutDashboard },
        { id: 'user-roles', title: 'User Roles', icon: Users },
        { id: 'schedule-engine', title: 'Schedule Engine', icon: Sparkles },
        { id: 'key-features', title: 'Key Features', icon: CheckCircle },
        { id: 'best-practices', title: 'Best Practices', icon: Shield },
        { id: 'troubleshooting', title: 'Troubleshooting', icon: AlertCircle },
    ];

    return (
        <div className="help-layout">
            <div className="help-main-wrapper">
                <header className="help-topbar">
                    <div className="help-topbar-left">
                        <div className="help-logo">
                            <img src={theme === 'light' ? '/logo.png' : '/logo-white.png'} alt="OptiSched" />
                        </div>
                        <div className="help-brand">
                            <h2>OptiSched</h2>
                            <span>Help Center</span>
                        </div>
                    </div>
                    <div className="help-topbar-right">
                        <button className="help-topbar-btn" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                        </button>
                        <button className="help-topbar-btn" onClick={() => navigate(-1)} aria-label="Back">
                            <ArrowLeft size={18} />
                        </button>
                    </div>
                </header>

                <div className="help-tabs">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            className={`help-tab ${activeSection === section.id ? 'help-tab-active' : ''}`}
                            onClick={() => setActiveSection(section.id)}
                        >
                            <section.icon size={16} />
                            <span>{section.title}</span>
                        </button>
                    ))}
                </div>

            <main className="help-main">
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
        </div>
    );
};

export default HelpPage;
                            <p>
                                The automated generator creates conflict-free schedules based on constraints, priorities, and availability. Schedule Managers can generate full schedules or regenerate specific sections, teachers, rooms, or subjects.
                            </p>
                            <div className="help-card-tags">
                                <span className="help-card-tag">Fixed blocks</span>
                                <span className="help-card-tag">Split sessions</span>
                                <span className="help-card-tag">Custom breaks</span>
                                <span className="help-card-tag">Priority weighting</span>
                                <span className="help-card-tag">Partial regeneration</span>
                            </div>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <FileCheck size={24} />
                            </div>
                            <h3>Approval Workflow</h3>
                            <p>
                                Draft, Submit, Approve, Publish. Every transition is logged, and nothing reaches users until an administrator signs off.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Scale size={24} />
                            </div>
                            <h3>Hard & Soft Constraints</h3>
                            <p>
                                Hard constraints are enforced. Soft constraints are optimized. Configure weights to match your institution priorities.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Gauge size={24} />
                            </div>
                            <h3>Faculty Workload</h3>
                            <p>
                                Role-based limits on daily hours, weekly hours, and consecutive sessions, with deloading rules for administrators.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <MessageSquare size={24} />
                            </div>
                            <h3>AI Assistant</h3>
                            <p>
                                Provider-agnostic AI layer that answers schedule questions for teachers and students, and helps managers with natural language data entry.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <GitBranch size={24} />
                            </div>
                            <h3>Versioning</h3>
                            <p>
                                Compare versions side-by-side, roll back in one click, and review the full edit history of every schedule.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Users size={24} />
                            </div>
                            <h3>Collaboration</h3>
                            <p>
                                Schedule managers share teachers, rooms, subjects, and sections. Public for reuse, private for sensitive work.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Bell size={24} />
                            </div>
                            <h3>Notifications</h3>
                            <p>
                                Teachers and students are notified only about schedules that actually affect them. Available on web and mobile.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <FolderTree size={24} />
                            </div>
                            <h3>Section Hierarchy</h3>
                            <p>
                                Folder-style grouping with configurable weights for Senior High and College. Prioritize critical programs during generation.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Building2 size={24} />
                            </div>
                            <h3>Special Rooms</h3>
                            <p>
                                Special subjects get priority access to specialized rooms while maintaining flexibility for general use when capacity allows.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="help-section" id="schedule-workflow">
                    <div className="help-section-header">
                        <h2>Schedule Workflow</h2>
                        <p>Step-by-step process from data entry to publication</p>
                    </div>
                    <div className="help-workflow">
                        <div className="workflow-step">
                            <div className="workflow-number">1</div>
                            <div className="workflow-content">
                                <h4>Data Preparation</h4>
                                <p>
                                    Schedule Managers enter all teachers, rooms, subjects, and sections with complete information. Set availability preferences, capacity limits, and priority weights.
                                </p>
                            </div>
                        </div>

                        <div className="workflow-step">
                            <div className="workflow-number">2</div>
                            <div className="workflow-content">
                                <h4>Schedule Generation</h4>
                                <p>
                                    Use the automated generator to create schedules. Configure generation options including priority strategy, conflict resolution, and constraint settings.
                                </p>
                            </div>
                        </div>

                        <div className="workflow-step">
                            <div className="workflow-number">3</div>
                            <div className="workflow-content">
                                <h4>Review and Edit</h4>
                                <p>
                                    Review the generated schedule for conflicts and issues. Make manual adjustments if needed. Check teacher preferences and room allocations.
                                </p>
                            </div>
                        </div>

                        <div className="workflow-step">
                            <div className="workflow-number">4</div>
                            <div className="workflow-content">
                                <h4>Submit for Approval</h4>
                                <p>
                                    Submit the schedule for review. Schedule Admins will review the schedule for conflicts, preferences, and institutional policies.
                                </p>
                            </div>
                        </div>

                        <div className="workflow-step">
                            <div className="workflow-number">5</div>
                            <div className="workflow-content">
                                <h4>Approval</h4>
                                <p>
                                    Schedule Admins approve or reject the schedule. If approved, the schedule is instantly distributed to teachers and students.
                                </p>
                            </div>
                        </div>

                        <div className="workflow-step">
                            <div className="workflow-number">6</div>
                            <div className="workflow-content">
                                <h4>Publication</h4>
                                <p>
                                    Approved schedules become the official published schedule. Teachers and students can view their schedules immediately.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="help-section" id="best-practices">
                    <div className="help-section-header">
                        <h2>Best Practices</h2>
                        <p>Recommendations for using OptiSched effectively</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card">
                            <div className="help-card-icon">
                                <Database size={24} />
                            </div>
                            <h3>For Schedule Generation</h3>
                            <ul>
                                <li>Complete data entry before generating</li>
                                <li>Set appropriate priority weights</li>
                                <li>Configure constraints properly</li>
                                <li>Review generated results thoroughly</li>
                                <li>Iterate if needed by adjusting priorities</li>
                            </ul>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <FileCheck size={24} />
                            </div>
                            <h3>For Schedule Approval</h3>
                            <ul>
                                <li>Review thoroughly before approving</li>
                                <li>Provide clear feedback when rejecting</li>
                                <li>Respond promptly to requests</li>
                                <li>Document decisions for future reference</li>
                                <li>Lock schedules after publication</li>
                            </ul>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <ClipboardList size={24} />
                            </div>
                            <h3>For Data Management</h3>
                            <ul>
                                <li>Keep data current and accurate</li>
                                <li>Use hierarchies for organization</li>
                                <li>Standardize naming conventions</li>
                                <li>Review data regularly</li>
                                <li>Backup important data</li>
                            </ul>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Shield size={24} />
                            </div>
                            <h3>For Security</h3>
                            <ul>
                                <li>Protect your credentials</li>
                                <li>Log out properly when finished</li>
                                <li>Report suspicious activity</li>
                                <li>Use strong passwords</li>
                                <li>Keep software updated</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section className="help-section" id="troubleshooting">
                    <div className="help-section-header">
                        <h2>Troubleshooting</h2>
                        <p>Solutions to common problems</p>
                    </div>
                    <div className="help-troubleshooting">
                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <AlertCircle size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Cannot log in</h4>
                                <p>Check your email and password. If you forgot your password, use the "Forgot Password" link. If you still can't log in, contact a System Admin.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <Eye size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Schedule not showing</h4>
                                <p>Check that you're viewing the correct academic year and semester. If the schedule should be there but isn't, contact a Schedule Manager.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Conflict detected</h4>
                                <p>Review the conflict details. Adjust the teacher, room, or time to resolve the conflict. If you can't resolve it, contact a Schedule Admin.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <XCircle size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Cannot edit schedule</h4>
                                <p>Check your role permissions. Only Schedule Managers (their own drafts), Schedule Admins, and Power Admins can edit schedules.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <FileCheck size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Approval request rejected</h4>
                                <p>Read the rejection reason. Make the requested changes and resubmit. If you disagree with the rejection, contact the approver to discuss.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <Bell size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Notification not received</h4>
                                <p>Check your notification settings. Ensure notifications are enabled. Check your spam folder if email notifications are used.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <Shield size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Cannot access a resource</h4>
                                <p>Check if the resource is shared with you. If it should be shared but isn't, contact the resource owner or a Schedule Manager.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <Sparkles size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Generator produces poor results</h4>
                                <p>Review and adjust priority weights. Check that all constraints are properly configured. Try different generation strategies. Ensure all data is complete.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <Gauge size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Performance is slow</h4>
                                <p>Check your internet connection. Try refreshing the page. If the problem persists, contact a System Admin to check server performance.</p>
                            </div>
                        </div>

                        <div className="troubleshooting-item">
                            <div className="troubleshooting-icon">
                                <Shield size={24} />
                            </div>
                            <div className="troubleshooting-content">
                                <h4>Permission denied error</h4>
                                <p>Check your role and permissions. If you believe you should have access, contact a System Admin to verify your role assignment.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="help-section" id="multi-role">
                    <div className="help-section-header">
                        <h2>Multi-Role Support</h2>
                        <p>How multi-role users can switch between roles</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <Users size={28} />
                            </div>
                            <h3>Role Combinations</h3>
                            <p>
                                A Teacher may also be a Schedule Manager and/or Schedule Admin (can hold all three simultaneously). A Schedule Manager may also be a Schedule Admin. A Schedule Admin may also be a Schedule Manager.
                            </p>
                            <div className="help-card-note">
                                <Info size={16} />
                                <span>Students cannot have additional roles. Power Admin and System Admin cannot have additional roles for security reasons.</span>
                            </div>
                        </div>

                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <RefreshCw size={28} />
                            </div>
                            <h3>Switching Between Roles</h3>
                            <p>
                                When a user has multiple roles, clicking the role badge in the top-right corner opens a role selector panel. The panel shows all roles the user holds. Selecting a role switches the sidebar tabs and dashboard to that role view.
                            </p>
                            <div className="help-card-note">
                                <Info size={16} />
                                <span>The system remembers the last selected role for the session.</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="help-section" id="permission-rules">
                    <div className="help-section-header">
                        <h2>Permission Rules Engine</h2>
                        <p>Configurable runtime permission system</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card help-card-wide">
                            <div className="help-card-icon">
                                <ShieldCheck size={28} />
                            </div>
                            <h3>What are System Rules?</h3>
                            <p>
                                System Admins configure runtime permission rules stored in the system_rules table. These rules control what users can see and do across the system.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Eye size={24} />
                            </div>
                            <h3>Common Rules</h3>
                            <p>
                                Teachers can see student schedules, schedule managers can create without approval, students can see teacher names.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <UserCog size={24} />
                            </div>
                            <h3>Configuration</h3>
                            <p>
                                Rules are configured by System Admins through the System Rules tab. Changes take effect immediately and are audit-logged.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <History size={24} />
                            </div>
                            <h3>Audit Trail</h3>
                            <p>
                                All rule changes are logged with who performed the action and timestamp for security and compliance.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="help-section" id="additional-resources">
                    <div className="help-section-header">
                        <h2>Additional Resources</h2>
                        <p>More information and support</p>
                    </div>
                    <div className="help-cards">
                        <div className="help-card">
                            <div className="help-card-icon">
                                <BookOpen size={24} />
                            </div>
                            <h3>Documentation</h3>
                            <p>
                                Access detailed technical documentation and API references for developers and administrators.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <MessageSquare size={24} />
                            </div>
                            <h3>Contact Support</h3>
                            <p>
                                Reach out to your institution's OptiSched administrator for account and access issues.
                            </p>
                        </div>

                        <div className="help-card">
                            <div className="help-card-icon">
                                <Smartphone size={24} />
                            </div>
                            <h3>Mobile App</h3>
                            <p>
                                Download the mobile app for on-the-go schedule viewing and notifications.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
            </div>
        </div>
    );
};

export default HelpPage;
