import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_ROLES, POWER_ADMIN_ROLES, ROLE_DISPLAY_NAMES } from '../types/database';
import type { UserRole } from '../types/database';
import {
    LayoutDashboard, Users, CalendarDays, AlertTriangle, Settings,
    MessageSquare, LogOut, Database, ClipboardList, BarChart3, Eye,
    History, Edit
} from 'lucide-react';
import FloatingOptiBot from './FloatingOptiBot';
import './Layout.css';

const Layout: React.FC = () => {
    const { profile, role, signOut } = useAuth();
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

    const isPowerAdmin = role ? POWER_ADMIN_ROLES.includes(role as UserRole) : false;
    const isAnyAdmin = role ? ADMIN_ROLES.includes(role as UserRole) : false;

    // Power Admin / legacy admin - full access
    const powerAdminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/users', icon: Users, label: 'User Management' },
        { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
        { to: '/admin/data', icon: Database, label: 'Data Management' },
        { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts' },
        { to: '/admin/constraints', icon: Settings, label: 'Constraints' },
        { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/admin/views', icon: Eye, label: 'Schedule Views' },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
        { to: '/admin/audit', icon: History, label: 'Audit Log' },
        { to: '/admin/editor', icon: Edit, label: 'Editor' },
        { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    // System Admin - user management only, no schedule access
    const systemAdminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/users', icon: Users, label: 'User Management' },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
        { to: '/admin/audit', icon: History, label: 'Audit Log' },
        { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    // Schedule Admin - approves schedules, views all, manual/auto overrides
    const scheduleAdminLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
        { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts' },
        { to: '/admin/views', icon: Eye, label: 'Schedule Views' },
        { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
        { to: '/admin/messages', icon: MessageSquare, label: 'Messages' },
        { to: '/admin/settings', icon: Settings, label: 'Settings' },
    ];

    // Schedule Manager (Program Heads) - creates schedules
    const scheduleManagerLinks = [
        { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
        { to: '/admin/data', icon: Database, label: 'Data Management' },
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

    // Determine links based on role
    const getLinks = () => {
        switch (role) {
            case 'admin':
            case 'power_admin':
                return powerAdminLinks;
            case 'system_admin':
                return systemAdminLinks;
            case 'schedule_admin':
                return scheduleAdminLinks;
            case 'schedule_manager':
                return scheduleManagerLinks;
            case 'teacher':
                return teacherLinks;
            default:
                return studentLinks;
        }
    };

    const links = getLinks();

    const getRoleBadgeClass = () => {
        if (isPowerAdmin) return 'badge badge-admin';
        if (isAnyAdmin) return 'badge badge-admin';
        if (role === 'teacher') return 'badge badge-teacher';
        return 'badge badge-student';
    };

    const displayRole = role ? (ROLE_DISPLAY_NAMES[role as UserRole] || role).toUpperCase() : 'USER';

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
                            <span className={getRoleBadgeClass()} style={{ fontSize: 8 }}>{displayRole}</span>
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
