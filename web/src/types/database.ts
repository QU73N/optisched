// TypeScript interfaces for all database entities - shared with the mobile app

export type UserRole = 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager' | 'teacher' | 'student';

// 'admin' is legacy - treated as power_admin in code
export const ADMIN_ROLES: UserRole[] = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];
export const POWER_ADMIN_ROLES: UserRole[] = ['admin', 'power_admin'];

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
    admin: 'Power Admin',
    power_admin: 'Power Admin',
    system_admin: 'System Administrator',
    schedule_admin: 'Schedule Administrator',
    schedule_manager: 'Schedule Manager',
    teacher: 'Teacher',
    student: 'Student',
};

// Roles visible in role selectors (deduplicated: admin treated as power_admin)
export const SELECTABLE_ROLE_DISPLAY: { value: UserRole; label: string }[] = [
    { value: 'power_admin', label: 'Power Admin' },
    { value: 'system_admin', label: 'System Administrator' },
    { value: 'schedule_admin', label: 'Schedule Administrator' },
    { value: 'schedule_manager', label: 'Schedule Manager' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'student', label: 'Student' },
];

// Helper: what roles can this role create?
export const CREATABLE_ROLES: Record<string, UserRole[]> = {
    admin: ['system_admin', 'schedule_admin', 'schedule_manager', 'teacher', 'student'],
    power_admin: ['system_admin', 'schedule_admin', 'schedule_manager', 'teacher', 'student'],
    system_admin: ['schedule_admin', 'schedule_manager', 'teacher', 'student'],
    schedule_admin: [],
    schedule_manager: [],
    teacher: [],
    student: [],
};
// Multi-role: primary role stays in `role` column (single valid enum).
// Additional roles stored in auth user_metadata.additional_roles (string[]).
// Teachers can ALSO be: schedule_admin, schedule_manager
// Teachers CANNOT be: admin, power_admin, system_admin, student
// Students CANNOT have multi-role
export const TEACHER_ADDABLE_ROLES: UserRole[] = ['schedule_admin', 'schedule_manager'];

// Build a full roles array from primary role + additional roles
export function getAllRoles(primaryRole: string | null | undefined, additionalRoles?: string[]): UserRole[] {
    const roles: UserRole[] = [];
    if (primaryRole) roles.push(primaryRole as UserRole);
    if (additionalRoles) {
        for (const r of additionalRoles) {
            if (r && !roles.includes(r as UserRole)) roles.push(r as UserRole);
        }
    }
    return roles;
}

// Check if a roles array includes a specific role
export function hasRole(allRoles: UserRole[], check: UserRole): boolean {
    return allRoles.includes(check);
}

// Check if any of the roles match
export function hasAnyRole(allRoles: UserRole[], checks: UserRole[]): boolean {
    return checks.some(c => allRoles.includes(c));
}

export type EmploymentType = 'full-time' | 'part-time';
export type RoomType = 'lecture' | 'laboratory' | 'gymnasium' | 'computer_lab';
export type SubjectType = 'lecture' | 'laboratory';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export type TimeSlot = 'morning' | 'afternoon' | 'evening';
export type ConflictType = 'room_conflict' | 'teacher_overlap' | 'capacity_exceeded' | 'unassigned';
export type ConflictSeverity = 'high' | 'medium' | 'low';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type ScheduleStatus = 'draft' | 'published' | 'archived';

export interface Profile {
    id: string;
    email: string;
    role: UserRole;
    full_name: string;
    avatar_url: string | null;
    department: string | null;
    program: string | null;
    year_level: number | null;
    section: string | null;
    created_at: string;
    updated_at: string;
}

export interface Teacher {
    id: string;
    profile_id: string;
    department: string;
    employment_type: EmploymentType;
    max_hours: number;
    current_load_percentage: number;
    is_active: boolean;
    weight: number;
    priority_note: string | null;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
    created_at: string;
    updated_at: string;
    profile?: Profile;
}

export interface Room {
    id: string;
    name: string;
    capacity: number;
    type: RoomType;
    building: string;
    floor: number;
    equipment: string[];
    is_available: boolean;
    weight: number;
    priority_note: string | null;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
    created_at: string;
}

export interface Subject {
    id: string;
    code: string;
    name: string;
    units: number;
    type: SubjectType;
    duration_hours: number;
    program: string;
    year_level: number;
    requires_lab: boolean;
    weight: number;
    priority_note: string | null;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
    created_at: string;
}

export interface Section {
    id: string;
    name: string;
    program: string;
    year_level: number;
    student_count: number;
    parent_id: string | null;
    weight: number;
    path: string | null;
    node_type: 'group' | 'section';
    is_active: boolean;
    description: string | null;
    metadata: Record<string, unknown>;
    sort_order: number;
    owner_id: string | null;
    is_public: boolean;
    shared_with: string[];
    created_at: string;
}

export interface Schedule {
    id: string;
    subject_id: string;
    teacher_id: string | null;
    room_id: string | null;
    section_id: string | null;
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    semester: string;
    academic_year: string;
    status: ScheduleStatus;
    teacher?: Teacher;
    room?: Room;
    section?: Section;
    is_locked?: boolean;
    locked_by?: string | null;
    locked_at?: string | null;
    lock_reason?: string | null;
}

export interface ScheduleVersion {
    id: string;
    schedule_id: string;
    version_number: number;
    snapshot: Record<string, unknown>;
    change_type: 'created' | 'updated' | 'deleted' | 'status_change' | 'checkpoint';
    change_summary: string | null;
    change_reason: string | null;
    changed_by: string;
    changed_at: string;
    previous_version_id: string | null;
}

export interface ScheduleVersionSet {
    id: string;
    name: string;
    description: string | null;
    academic_year: string;
    semester: string;
    is_published: boolean;
    created_by: string;
    created_at: string;
}

export interface ScheduleVersionSetItem {
    id: string;
    version_set_id: string;
    schedule_version_id: string;
}

export interface VersionComparison {
    field: string;
    old_value: string;
    new_value: string;
    change_type: 'added' | 'removed' | 'modified';
}

export interface PriorityConfig {
    id: string;
    key: string;
    value: Record<string, unknown>;
    description: string | null;
    category: string;
    is_active: boolean;
    updated_by: string | null;
    updated_at: string;
    created_at: string;
}

export interface SharingRequest {
    id: string;
    resource_type: 'teacher' | 'room' | 'subject' | 'section';
    resource_id: string;
    from_user_id: string;
    to_user_id: string;
    status: 'pending' | 'approved' | 'rejected';
    message: string | null;
    created_at: string;
    responded_at: string | null;
    from_user?: Profile;
    to_user?: Profile;
}

export interface InstitutionBreak {
    id: string;
    name: string;
    break_type: 'lunch' | 'recess' | 'assembly' | 'other';
    day_of_week: DayOfWeek | 'all';
    start_time: string;
    end_time: string;
    is_active: boolean;
    academic_year: string | null;
    semester: string | null;
    description: string | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export interface Notification {
    id: string;
    user_id: string;
    type: 'schedule_change' | 'sharing_request' | 'approval' | 'system' | 'reminder';
    title: string;
    message: string;
    data: Record<string, unknown>;
    is_read: boolean;
    action_url: string | null;
    created_at: string;
    expires_at: string | null;
}

export interface ApprovalRequest {
    id: string;
    request_type: 'schedule_change' | 'new_schedule' | 'delete_schedule' | 'bulk_change';
    resource_type: 'schedule' | 'section' | 'teacher' | 'room' | 'subject';
    resource_id: string | null;
    requested_by: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    title: string;
    description: string | null;
    change_data: Record<string, unknown>;
    approved_by: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    academic_year: string | null;
    semester: string | null;
    created_at: string;
    updated_at: string;
    requested_by_user?: Profile;
    approved_by_user?: Profile;
}

export interface ApprovalAuditLog {
    id: string;
    approval_request_id: string;
    action: 'created' | 'approved' | 'rejected' | 'cancelled' | 'commented';
    performed_by: string | null;
    notes: string | null;
    previous_status: string | null;
    new_status: string | null;
    created_at: string;
    performed_by_user?: Profile;
}

export interface Conflict {
    id: string;
    type: ConflictType;
    severity: ConflictSeverity;
    title: string;
    description: string;
    schedule_a_id: string | null;
    schedule_b_id: string | null;
    is_resolved: boolean;
    resolved_at: string | null;
    resolved_by: string | null;
    created_at: string;
    schedule_a?: Schedule;
    schedule_b?: Schedule;
}
