import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_ROLES, POWER_ADMIN_ROLES, ROLE_DISPLAY_NAMES, hasAnyRole } from '../types/database';
import Sidebar from './Sidebar';
import { logActivity } from '../hooks/useActivityLogger';
import { useIdleTimeout } from '../hooks/useIdleTimeout';
import { usePermissions } from '../hooks/usePermissions';
import IdleTimeoutModal, { type IdleMode } from './IdleTimeoutModal';
import RoleSelector from './RoleSelector';
import SystemStats from './SystemStats';
import PowerAdminStats from './PowerAdminStats';
import LoadByDay from './LoadByDay';

import {
    LogOut, Moon, Sun, Bell, HelpCircle, PanelLeft, Settings,
    Sparkles, CalendarDays, Users, Database
} from 'lucide-react';
import FloatingOptiBot from './FloatingOptiBot';
import './Layout.css';

const Layout: React.FC = () => {
    const { profile, role, roles, signOut, switchRole } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState(() => localStorage.getItem('optisched-theme') || 'light');
    const [siderailOpen, setSiderailOpen] = useState(true);
    const [roleSelectorOpen, setRoleSelectorOpen] = useState(false);

    useEffect(() => {
        const handleStorageChange = () => {
            setTheme(localStorage.getItem('optisched-theme') || 'light');
        };
        window.addEventListener('storage', handleStorageChange);
        const observer = new MutationObserver(() => {
            const newTheme = document.documentElement.getAttribute('data-theme') || 'light';
            setTheme(newTheme);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            observer.disconnect();
        };
    }, []);

    const handleSignOut = useCallback(async () => {
        await signOut();
        navigate('/login');
    }, [signOut, navigate]);

    // ---------- Idle timeout (Session 2 / C4) ------------------------------
    const perms = usePermissions();
    const idleMinutes = useMemo(() => {
        const map = perms.getRule('idle_timeout_minutes_by_role') as Record<string, number> | undefined;
        if (map && role && typeof map[role] === 'number') return map[role];
        return perms.ruleNumber('session_timeout_minutes', 60);
    }, [perms, role]);
    const graceSeconds = useMemo(
        () => perms.ruleNumber('idle_timeout_grace_seconds', 30),
        [perms],
    );
    const idleMode: IdleMode = useMemo(() => {
        const reauthRoles = (perms.getRule('idle_reauth_roles') as string[] | undefined) || ['power_admin', 'admin'];
        return role && reauthRoles.includes(role) ? 'reauth' : 'signout';
    }, [perms, role]);

    const handleIdleWarn = useCallback(() => {
        // no-op: useIdleTimeout sets state we observe via .warning
    }, []);
    const handleIdleTimeout = useCallback(() => {
        if (idleMode === 'signout') {
            void logActivity({ actionType: 'logout', resource: 'auth', details: { reason: 'idle_timeout' } });
            void handleSignOut();
        }
        // For 'reauth' mode the modal stays open until the user re-auths or
        // manually clicks Sign out; no auto sign-out at grace expiry.
    }, [idleMode, handleSignOut]);

    const idle = useIdleTimeout({
        idleMinutes,
        graceSeconds,
        onWarn: handleIdleWarn,
        onTimeout: handleIdleTimeout,
        disabled: !profile,
    });

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

    const isPowerAdmin = hasAnyRole(roles, POWER_ADMIN_ROLES);
    const isAnyAdmin = hasAnyRole(roles, ADMIN_ROLES);

    // Activity logging: page view on every route change
    useEffect(() => {
        logActivity({ actionType: 'page_view', resource: location.pathname });
    }, [location.pathname]);

    // Sidebar navigation is now handled by <Sidebar /> via src/config/sidebar.ts

    const getRoleBadgeClass = () => {
        if (isPowerAdmin) return 'badge badge-admin';
        if (isAnyAdmin) return 'badge badge-admin';
        if (role === 'teacher') return 'badge badge-teacher';
        return 'badge badge-student';
    };

    // Shorten long multi-role display names
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

    const handleRoleBadgeClick = () => {
        if (roles.length > 1) {
            setRoleSelectorOpen(true);
        }
    };

    const handleRoleSelect = (selectedRole: typeof role) => {
        if (selectedRole) {
            switchRole(selectedRole);
        }
        setRoleSelectorOpen(false);
    };

    return (
        <div className={`layout ${siderailOpen ? 'siderail-open-layout' : ''}`}>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <aside className="sidebar">
                <Sidebar />

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">
                            {profile?.full_name
                                ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)
                                : '?'}
                        </div>
                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name">{profile?.full_name || 'User'}</span>
                            <button
                                className={`${getRoleBadgeClass()} badge-sm ${roles.length > 1 ? 'badge-clickable' : ''}`}
                                title={displayRole}
                                onClick={handleRoleBadgeClick}
                                aria-label={roles.length > 1 ? 'Switch role' : displayRole}
                            >
                                {displayRole}
                            </button>
                        </div>
                    </div>
                    <button className="sidebar-logout" onClick={handleSignOut} aria-label="Sign Out">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            <header className="topbar">
                <div className="topbar-left">
                    <div className="sidebar-logo">
                        <img src={theme === 'light' ? '/logo.png' : '/logo-white.png'} alt="OptiSched" />
                    </div>
                    <div className="sidebar-brand">
                        <h2>OptiSched</h2>
                        <span>Scheduling System</span>
                    </div>
                </div>
                <div className="topbar-right">
                    <button className="topbar-btn" onClick={() => setSiderailOpen(!siderailOpen)} aria-label="Toggle sidebar">
                        <PanelLeft size={18} />
                    </button>
                    <button className="topbar-btn" onClick={toggleTheme} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                    <button className="topbar-btn" aria-label="Notifications">
                        <Bell size={18} />
                    </button>
                    <button className="topbar-btn" onClick={() => window.open('https://github.com/your-repo/optisched/wiki', '_blank')} aria-label="Open help documentation">
                        <HelpCircle size={18} />
                    </button>
                    <button className="topbar-btn" onClick={() => navigate(`/${role}/settings`)} aria-label="Settings">
                        <Settings size={18} />
                    </button>
                </div>
            </header>

            <div className="main-wrapper">
                <main id="main-content" className="main-content">
                    <Outlet />
                </main>
            </div>

            <aside className={`siderail ${siderailOpen ? 'siderail-open' : ''}`}>
                <div className="siderail-content">
                    <div className="siderail-section">
                        <h4>Quick Actions</h4>
                        <div className="siderail-grid">
                            {isAnyAdmin && (
                                <button className="siderail-action" onClick={() => navigate(`/${role}/generate`)} aria-label="Generate Schedule">
                                    <Sparkles size={18} />
                                    <span>Generate</span>
                                </button>
                            )}
                            <button className="siderail-action" onClick={() => navigate(`/${role}/schedules`)} aria-label="View Schedules">
                                <CalendarDays size={18} />
                                <span>Schedules</span>
                            </button>
                            {isAnyAdmin && (
                                <button className="siderail-action" onClick={() => navigate(`/${role}/users`)} aria-label="Manage Users">
                                    <Users size={18} />
                                    <span>Users</span>
                                </button>
                            )}
                            {isAnyAdmin && (
                                <button className="siderail-action" onClick={() => navigate(`/${role}/data`)} aria-label="View Data">
                                    <Database size={18} />
                                    <span>Data</span>
                                </button>
                            )}
                        </div>
                    </div>
                    <SystemStats />
                    <PowerAdminStats />
                    <LoadByDay />
                </div>
            </aside>

            <FloatingOptiBot />

            <RoleSelector
                isOpen={roleSelectorOpen}
                onClose={() => setRoleSelectorOpen(false)}
                currentRole={role}
                availableRoles={roles}
                onRoleSelect={handleRoleSelect}
            />

            <IdleTimeoutModal
                open={idle.warning}
                mode={idleMode}
                secondsLeft={idle.secondsLeft}
                onStay={idle.reset}
                onSignOut={handleSignOut}
            />
        </div>
    );
};

export default Layout;
