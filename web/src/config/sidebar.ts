// Sidebar configuration - single source of truth for tab structure per role.
// Mirrors PRD §27.5 Comprehensive Tab Map (v1.2).

import type { LucideIcon } from 'lucide-react';
import {
    LayoutDashboard, Users, CalendarDays, AlertTriangle, Settings,
    MessageSquare, Database, ClipboardList, Sparkles, UserCheck,
    Shield, FileSearch, CheckCircle, Activity, Server, Save,
    AlertOctagon, ToggleRight, Megaphone, Briefcase, Building2,
    Palette, Inbox, Clock, BookOpen, History, Share2, FileText,
    User, Calendar, ListChecks, HelpCircle, Bot, Monitor, DoorOpen
} from 'lucide-react';

export interface NavLink {
    to: string;
    icon: LucideIcon;
    label: string;
    badgeKey?: string;   // optional: dashboard reads count from a key (e.g. 'approvals')
    end?: boolean;       // exact match for nav active state
    powerOnly?: boolean; // hidden from System Admin even within /admin space
}

export interface NavGroup {
    label: string;
    links: NavLink[];
}

// ----- Power Admin: full control -----
export const POWER_ADMIN_NAV: NavGroup[] = [
    {
        label: 'Overview',
        links: [
            { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        ],
    },
    {
        label: 'Operations',
        links: [
            { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
            { to: '/admin/approvals', icon: CheckCircle, label: 'Approvals', badgeKey: 'approvals' },
            { to: '/admin/generate', icon: Sparkles, label: 'Generate' },
            { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts', badgeKey: 'conflicts' },
            { to: '/admin/faculty', icon: UserCheck, label: 'Faculty' },
            { to: '/admin/rooms', icon: DoorOpen, label: 'Rooms' },
            { to: '/admin/data', icon: Database, label: 'Data' },
        ],
    },
    {
        label: 'Governance',
        links: [
            { to: '/admin/users', icon: Users, label: 'Users' },
            { to: '/admin/rules', icon: Shield, label: 'Rules' },
            { to: '/admin/audit', icon: FileSearch, label: 'Audit', powerOnly: true },
            { to: '/admin/activity', icon: Activity, label: 'Activity' },
            { to: '/admin/sessions', icon: Server, label: 'Sessions' },
            { to: '/admin/health', icon: Monitor, label: 'Health' },
            { to: '/admin/backup', icon: Save, label: 'Backup', powerOnly: true },
            { to: '/admin/override', icon: AlertOctagon, label: 'Override', powerOnly: true },
            { to: '/admin/flags', icon: ToggleRight, label: 'Flags', powerOnly: true },
        ],
    },
    {
        label: 'Communication',
        links: [
            { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
            { to: '/admin/messages', icon: MessageSquare, label: 'Messages', badgeKey: 'messages' },
        ],
    },
    {
        label: 'Personal',
        links: [
            { to: '/admin/tasks', icon: ClipboardList, label: 'Tasks' },
            { to: '/admin/settings', icon: Settings, label: 'Settings' },
        ],
    },
];

// ----- System Admin: governance & system health (no schedule editing) -----
export const SYSTEM_ADMIN_NAV: NavGroup[] = [
    {
        label: 'Overview',
        links: [
            { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        ],
    },
    {
        label: 'Governance',
        links: [
            { to: '/admin/users', icon: Users, label: 'Users' },
            { to: '/admin/rules', icon: Shield, label: 'Rules' },
            { to: '/admin/activity', icon: Activity, label: 'Activity' },
            { to: '/admin/sessions', icon: Server, label: 'Sessions' },
            { to: '/admin/health', icon: Monitor, label: 'Health' },
            { to: '/admin/lifecycle', icon: Briefcase, label: 'Lifecycle' },
            { to: '/admin/structure', icon: Building2, label: 'Departments' },
            { to: '/admin/branding', icon: Palette, label: 'Branding' },
        ],
    },
    {
        label: 'Communication',
        links: [
            { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
            { to: '/admin/messages', icon: MessageSquare, label: 'Messages', badgeKey: 'messages' },
        ],
    },
    {
        label: 'Personal',
        links: [
            { to: '/admin/tasks', icon: ClipboardList, label: 'Tasks' },
            { to: '/admin/settings', icon: Settings, label: 'Settings' },
        ],
    },
];

// ----- Schedule Admin: approval & review -----
export const SCHEDULE_ADMIN_NAV: NavGroup[] = [
    {
        label: 'Overview',
        links: [
            { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        ],
    },
    {
        label: 'Operations',
        links: [
            { to: '/admin/approvals', icon: CheckCircle, label: 'Approvals', badgeKey: 'approvals' },
            { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
            { to: '/admin/history', icon: History, label: 'History' },
            { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts', badgeKey: 'conflicts' },
            { to: '/admin/requests', icon: Inbox, label: 'Requests', badgeKey: 'requests' },
            { to: '/admin/faculty', icon: UserCheck, label: 'Faculty' },
            { to: '/admin/rooms', icon: DoorOpen, label: 'Rooms' },
        ],
    },
    {
        label: 'Communication',
        links: [
            { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
            { to: '/admin/messages', icon: MessageSquare, label: 'Messages', badgeKey: 'messages' },
        ],
    },
    {
        label: 'Personal',
        links: [
            { to: '/admin/settings', icon: Settings, label: 'Settings' },
        ],
    },
];

// ----- Schedule Manager: schedule construction -----
export const SCHEDULE_MANAGER_NAV: NavGroup[] = [
    {
        label: 'Overview',
        links: [
            { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
        ],
    },
    {
        label: 'Operations',
        links: [
            { to: '/admin/schedules', icon: CalendarDays, label: 'Schedules' },
            { to: '/admin/generate', icon: Sparkles, label: 'Generate' },
            { to: '/admin/data', icon: Database, label: 'Data' },
            { to: '/admin/conflicts', icon: AlertTriangle, label: 'Conflicts', badgeKey: 'conflicts' },
            { to: '/admin/faculty', icon: UserCheck, label: 'Faculty' },
            { to: '/admin/rooms', icon: DoorOpen, label: 'Rooms' },
            { to: '/admin/sharing', icon: Share2, label: 'Sharing' },
            { to: '/admin/templates', icon: FileText, label: 'Templates' },
        ],
    },
    {
        label: 'Communication',
        links: [
            { to: '/admin/messages', icon: MessageSquare, label: 'Messages', badgeKey: 'messages' },
        ],
    },
    {
        label: 'Personal',
        links: [
            { to: '/admin/settings', icon: Settings, label: 'Settings' },
        ],
    },
];

// ----- Teacher: personal operations -----
export const TEACHER_NAV: NavGroup[] = [
    {
        label: 'Overview',
        links: [
            { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard', end: true },
        ],
    },
    {
        label: 'Personal',
        links: [
            { to: '/teacher/schedule', icon: Calendar, label: 'Schedule' },
            { to: '/teacher/workload', icon: BookOpen, label: 'Workload' },
            { to: '/teacher/preferences', icon: ListChecks, label: 'Preferences' },
            { to: '/teacher/requests', icon: Inbox, label: 'Requests' },
            { to: '/teacher/sections', icon: Users, label: 'Sections' },
        ],
    },
    {
        label: 'Communication',
        links: [
            { to: '/teacher/chat', icon: MessageSquare, label: 'Messages', badgeKey: 'messages' },
            { to: '/teacher/announcements', icon: Megaphone, label: 'Announcements' },
        ],
    },
    {
        label: 'Settings',
        links: [
            { to: '/teacher/settings', icon: Settings, label: 'Settings' },
        ],
    },
];

// ----- Student: view-only personal -----
export const STUDENT_NAV: NavGroup[] = [
    {
        label: 'Overview',
        links: [
            { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
        ],
    },
    {
        label: 'Personal',
        links: [
            { to: '/student/schedule', icon: Calendar, label: 'Schedule' },
            { to: '/student/upcoming', icon: Clock, label: 'Upcoming' },
        ],
    },
    {
        label: 'Communication',
        links: [
            { to: '/student/announcements', icon: Megaphone, label: 'Announcements' },
            { to: '/student/optibot', icon: Bot, label: 'OptiBot' },
            { to: '/student/help', icon: HelpCircle, label: 'Help' },
        ],
    },
    {
        label: 'Settings',
        links: [
            { to: '/student/settings', icon: Settings, label: 'Settings' },
        ],
    },
];

// Resolve which nav config to use given primary role + multi-role array
export function resolveNav(role: string | null, roles: string[]): NavGroup[] {
    if (!role) return STUDENT_NAV;
    // Check for Power Admin in roles array (multi-role support)
    const hasPowerAdmin = roles.includes('admin') || roles.includes('power_admin');
    if (role === 'admin' || role === 'power_admin' || hasPowerAdmin) return POWER_ADMIN_NAV;
    if (role === 'system_admin') return SYSTEM_ADMIN_NAV;
    if (role === 'schedule_admin') return SCHEDULE_ADMIN_NAV;
    if (role === 'schedule_manager') return SCHEDULE_MANAGER_NAV;
    if (role === 'student') return STUDENT_NAV;

    // Teacher: base nav, plus extra group(s) if multi-role
    if (role === 'teacher') {
        const groups = [...TEACHER_NAV];
        const extra = roles.filter(r => r !== 'teacher');
        for (const r of extra) {
            if (r === 'schedule_admin') {
                groups.splice(groups.length - 1, 0, {
                    label: 'Approvals',
                    links: SCHEDULE_ADMIN_NAV
                        .find(g => g.label === 'Operations')?.links
                        .map(l => ({ ...l, to: l.to })) || [],
                });
            } else if (r === 'schedule_manager') {
                groups.splice(groups.length - 1, 0, {
                    label: 'Build',
                    links: SCHEDULE_MANAGER_NAV
                        .find(g => g.label === 'Operations')?.links
                        .map(l => ({ ...l, to: l.to })) || [],
                });
            }
        }
        return groups;
    }

    return STUDENT_NAV;
}

// Quick helper to flatten all links across groups (used by search)
export function flattenNav(groups: NavGroup[]): NavLink[] {
    return groups.flatMap(g => g.links);
}

// Suppress unused imports (icons reserved for future tabs)
void [User, Inbox];
