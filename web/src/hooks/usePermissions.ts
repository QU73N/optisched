// usePermissions v2 - reads role + 3-tier Permission Rules Engine.
// Resolves precedence: per-user override -> role override -> global rule -> default.
//
// Backend RLS is the source of truth. This hook is for UI gating only.

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types/database';

export type RuleKey =
    | 'teachers_can_see_student_schedules'
    | 'students_can_see_teacher_names'
    | 'students_can_see_classmates'
    | 'schedule_managers_require_approval'
    | 'schedule_managers_can_edit_others_drafts'
    | 'teachers_can_message_admins'
    | 'teachers_can_message_other_teachers'
    | 'teachers_can_submit_change_requests'
    | 'teachers_can_view_section_rosters'
    | 'students_can_see_section_wide_schedule'
    | 'students_can_use_optibot'
    | 'session_timeout_minutes'
    | 'password_min_length'
    | 'require_2fa_for_admins'
    | 'audit_log_retention_days'
    | 'activity_log_retention_days'
    | 'auto_archive_old_schedules_days';

// Role rank used for hierarchy checks (mirrors SQL role_rank())
export const ROLE_RANK: Record<string, number> = {
    admin: 6,
    power_admin: 6,
    system_admin: 5,
    schedule_admin: 4,
    schedule_manager: 3,
    teacher: 2,
    student: 1,
};
export const rankOf = (r?: string | null) => (r ? ROLE_RANK[r] ?? 0 : 0);

export interface SystemRulesMap { [k: string]: unknown; }
export interface RoleOverridesMap { [role: string]: SystemRulesMap; }
export interface UserOverrideRow { rule_key: string; rule_value: unknown; expires_at: string | null; }

const POWER_ADMIN: UserRole[] = ['admin', 'power_admin'];
const SYSTEM_ADMIN: UserRole[] = ['admin', 'power_admin', 'system_admin'];
const SCHED_ADMIN: UserRole[] = ['admin', 'power_admin', 'schedule_admin'];
const ADMIN_TIER: UserRole[] = [
    'admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'
];

export function usePermissions() {
    const { role, roles, profile } = useAuth();
    const [globalRules, setGlobalRules] = useState<SystemRulesMap>({});
    const [roleOverrides, setRoleOverrides] = useState<RoleOverridesMap>({});
    const [userOverrides, setUserOverrides] = useState<SystemRulesMap>({});
    const [rulesLoaded, setRulesLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const fetchRules = async () => {
            try {
                const { data, error } = await supabase
                    .from('system_rules')
                    .select('rule_key, rule_value, role_overrides');
                if (error) throw error;
                if (cancelled) return;
                const global: SystemRulesMap = {};
                const ro: RoleOverridesMap = {};
                for (const row of data || []) {
                    global[row.rule_key as string] = row.rule_value;
                    if (row.role_overrides && typeof row.role_overrides === 'object') {
                        for (const [r, v] of Object.entries(row.role_overrides as Record<string, unknown>)) {
                            if (!ro[r]) ro[r] = {};
                            ro[r][row.rule_key as string] = v;
                        }
                    }
                }
                setGlobalRules(global);
                setRoleOverrides(ro);
            } catch (err) {
                console.warn('[usePermissions] system_rules unavailable, using defaults:', err);
            }

            // per-user overrides (only for current user; admins fetch others elsewhere)
            if (profile?.id) {
                try {
                    const { data } = await supabase
                        .from('user_permission_overrides')
                        .select('rule_key, rule_value, expires_at')
                        .eq('user_id', profile.id);
                    if (cancelled) return;
                    const now = Date.now();
                    const uo: SystemRulesMap = {};
                    (data || []).forEach((row: UserOverrideRow) => {
                        if (row.expires_at && new Date(row.expires_at).getTime() < now) return;
                        uo[row.rule_key] = row.rule_value;
                    });
                    setUserOverrides(uo);
                } catch (err) {
                    console.warn('[usePermissions] user_permission_overrides unavailable:', err);
                }
            }
            if (!cancelled) setRulesLoaded(true);
        };
        fetchRules();
        return () => { cancelled = true; };
    }, [profile?.id]);

    return useMemo(() => {
        const hasAny = (checks: UserRole[]): boolean =>
            (roles.length ? roles : (role ? [role] : [])).some(r => checks.includes(r));

        // Resolve effective rule with 3-tier precedence
        const getRule = (key: string): unknown => {
            if (key in userOverrides) return userOverrides[key];
            if (role && roleOverrides[role] && key in roleOverrides[role]) {
                return roleOverrides[role][key];
            }
            return globalRules[key];
        };

        const ruleEnabled = (key: RuleKey | string, fallback = false): boolean => {
            const v = getRule(key);
            if (v === undefined || v === null) return fallback;
            if (typeof v === 'boolean') return v;
            if (typeof v === 'string') return v === 'true';
            return Boolean(v);
        };

        const ruleNumber = (key: RuleKey | string, fallback = 0): number => {
            const v = getRule(key);
            if (typeof v === 'number') return v;
            if (typeof v === 'string') { const n = parseInt(v, 10); return isNaN(n) ? fallback : n; }
            return fallback;
        };

        const isPowerAdmin = hasAny(POWER_ADMIN);
        const isSystemAdmin = hasAny(SYSTEM_ADMIN);
        const isScheduleAdmin = hasAny(SCHED_ADMIN);
        const isScheduleManager = hasAny(['schedule_manager', 'admin', 'power_admin']);
        const isAdminTier = hasAny(ADMIN_TIER);
        const isTeacher = hasAny(['teacher']);
        const isStudent = role === 'student';

        const myRank = rankOf(role);
        const canEditUser = (targetRole?: string | null): boolean => {
            if (!targetRole) return false;
            if (myRank < 5) return false; // Only Power + System Admin
            return myRank > rankOf(targetRole);
        };

        return {
            // raw role info
            role, roles, profile, rulesLoaded,
            globalRules, roleOverrides, userOverrides,
            myRank, rankOf, canEditUser,

            // role tier checks
            isPowerAdmin,
            isSystemAdmin,
            isScheduleAdmin,
            isScheduleManager,
            isAdminTier,
            isTeacher,
            isStudent,

            // capability checks (combine role + rules)
            canManageUsers: isSystemAdmin,
            canViewAuditLogs: isPowerAdmin,
            canEditSystemRules: isSystemAdmin,
            canApproveSchedules: isScheduleAdmin,
            canEditAnySchedule: isScheduleAdmin,
            canCreateSchedules: hasAny(['admin','power_admin','schedule_manager']),
            canDirectPublish: isPowerAdmin || isScheduleAdmin
                || (isScheduleManager && !ruleEnabled('schedule_managers_require_approval', true)),
            canPostAnnouncements: hasAny(['admin','power_admin','system_admin','schedule_admin']),
            canSeeUserStats: isSystemAdmin,
            canSeeSystemHealth: isSystemAdmin,
            canSeeApprovalQueue: isScheduleAdmin,
            canSeeConflicts: isAdminTier,
            canSeeFacultyLoad: isAdminTier || isTeacher,
            canSeeAllSchedules: hasAny(['admin','power_admin','system_admin','schedule_admin']),
            canSeeOwnSchedule: isTeacher || isStudent,
            canSubmitChangeRequest: isTeacher && ruleEnabled('teachers_can_submit_change_requests', true),
            canMessageAdmins: isAdminTier
                || (isTeacher && ruleEnabled('teachers_can_message_admins', true)),

            // rules engine accessor
            ruleEnabled,
            ruleNumber,
            getRule,
        };
    }, [role, roles, profile, globalRules, roleOverrides, userOverrides, rulesLoaded]);
}
