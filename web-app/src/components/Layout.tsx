import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_ROLES, POWER_ADMIN_ROLES, ROLE_DISPLAY_NAMES, hasAnyRole } from '../types/database';

import {
    LayoutDashboard, Users, CalendarDays, AlertTriangle, Settings,
    MessageSquare, LogOut, Database, ClipboardList,
    Edit, UserCheck
} from 'lucide-react';
import FloatingOptiBot from './FloatingOptiBot';
import './Layout.css';

const Layout: React.FC = () => {
    const { profile, role, roles, signOut } = useAuth();
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [theme, setTheme] = useState(() => localStorage.getItem('optisched-theme') || 'light');

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

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const isPowerAdmin = hasAnyRole(roles, POWER_ADMIN_ROLES);
    const isAnyAdmin = hasAnyRole(roles, ADMIN_ROLES);

    // Power Admin / legacy admin - full access
    const powerAdminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/users', icon: Users, label: 'Users' },
        { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
        { to: '/admin/data', icon: Database, label: 'Data' },
        { to: '/admin/editor', icon: Edit, label: 'Editor' },
        { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts' },
        { to: '/admin/faculty', icon: UserCheck, label: 'Faculty' },
        { to: '/admin/tasks', icon: ClipboardList, label: 'Tasks' },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },

        { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    // System Admin - user management only, no schedule access
    const systemAdminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/users', icon: Users, label: 'Users' },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },

        { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    // Schedule Admin - approves schedules, views all
    const scheduleAdminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
        { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts' },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },

        { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    // Schedule Manager (Program Heads) - creates schedules
    const scheduleManagerLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
        { to: '/admin/data', icon: Database, label: 'Data' },
        { to: '/admin/editor', icon: Edit, label: 'Editor' },
        { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts' },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },

        { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    const teacherLinks = [
        { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/teacher/schedule', icon: CalendarDays, label: 'My Schedule' },
        { to: '/teacher/preferences', icon: ClipboardList, label: 'Preferences' },
        { to: '/teacher/chat', icon: MessageSquare, label: 'Messages' },

        { to: '/teacher/settings', icon: Settings, label: 'Settings' },
    ];

    const studentLinks = [
        { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/student/schedule', icon: CalendarDays, label: 'My Schedule' },

        { to: '/student/settings', icon: Settings, label: 'Settings' },
    ];

    // Determine links: teachers with additional roles get teacher base + unique admin features only
    const getLinks = () => {
        // Power admin gets everything
        if (isPowerAdmin) return powerAdminLinks;

        // Pure admin roles (no teacher primary)
        if (role !== 'teacher' && role !== 'student') {
            switch (role) {
                case 'system_admin': return systemAdminLinks;
                case 'schedule_admin': return scheduleAdminLinks;
                case 'schedule_manager': return scheduleManagerLinks;
                default: return studentLinks;
            }
        }

        // Student — no multi-role
        if (role === 'student') return studentLinks;

        // Teacher — base links always shown
        const finalLinks = [...teacherLinks];

        // If teacher has additional admin roles, add ONLY the unique admin features
        // (skip Dashboard, Messages, OptiBot, Settings since teacher already has those)
        const teacherLabelSet = new Set(teacherLinks.map(l => l.label));
        const additionalRoles = roles.filter(r => r !== 'teacher');

        for (const r of additionalRoles) {
            let adminLinks: typeof powerAdminLinks = [];
            switch (r) {
                case 'schedule_admin': adminLinks = scheduleAdminLinks; break;
                case 'schedule_manager': adminLinks = scheduleManagerLinks; break;
                case 'system_admin': adminLinks = systemAdminLinks; break;
            }
            for (const link of adminLinks) {
                // Only add links that don't duplicate teacher sidebar items
                if (!teacherLabelSet.has(link.label) && !finalLinks.some(l => l.label === link.label)) {
                    finalLinks.splice(finalLinks.length - 1, 0, link); // Insert before Settings
                }
            }
        }

        return finalLinks;
    };

    const links = getLinks();

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
        'Power User': 'Power User',
        'Teacher': 'Teacher',
        'Student': 'Student',
    };
    const displayRole = roles.length > 1
        ? roles.map(r => SHORT_NAMES[ROLE_DISPLAY_NAMES[r]] || ROLE_DISPLAY_NAMES[r] || r).join(' · ').toUpperCase()
        : role ? (ROLE_DISPLAY_NAMES[role] || role).toUpperCase() : 'USER';

    return (
        <div className="layout">
            <aside
                className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
                onMouseEnter={() => setSidebarCollapsed(false)}
                onMouseLeave={() => setSidebarCollapsed(true)}
            >
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <img src={theme === 'light' ? '/logo.png' : '/logo-white.png'} alt="OptiSched" />
                    </div>
                    <div className="sidebar-brand">
                        <h2>OptiSched</h2>
                        <span>Scheduling System</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {links.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                            }
                        >
                            <link.icon size={18} />
                            <span>{link.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="sidebar-user">
                        <div className="sidebar-avatar">
                            {profile?.full_name
                                ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2)
                                : '?'}
                        </div>
                        <div className="sidebar-user-info">
                            <span className="sidebar-user-name">{profile?.full_name || 'User'}</span>
                            <span className={getRoleBadgeClass()} style={{ fontSize: 8, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{displayRole}</span>
                        </div>
                    </div>
                    <button className="sidebar-logout" onClick={handleSignOut} title="Sign Out">
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>

            <main className={`main-content ${sidebarCollapsed ? 'main-content-expanded' : ''}`}>
                <Outlet />
            </main>

            <FloatingOptiBot />
        </div>
    );
};

export default Layout;
