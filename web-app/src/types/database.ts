// TypeScript interfaces for all database entities - shared with the mobile app

export type UserRole = 'admin' | 'power_admin' | 'system_admin' | 'schedule_admin' | 'schedule_manager' | 'teacher' | 'student';

// 'admin' is legacy - treated as power_admin in code
export const ADMIN_ROLES: UserRole[] = ['admin', 'power_admin', 'system_admin', 'schedule_admin', 'schedule_manager'];
export const POWER_ADMIN_ROLES: UserRole[] = ['admin', 'power_admin'];

export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
    admin: 'Power User',
    power_admin: 'Power User',
    system_admin: 'System Administrator',
    schedule_admin: 'Schedule Administrator',
    schedule_manager: 'Schedule Manager',
    teacher: 'Teacher',
    student: 'Student',
};

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
    created_at: string;
}

export interface Section {
    id: string;
    name: string;
    program: string;
    year_level: number;
    student_count: number;
    created_at: string;
}

export interface Schedule {
    id: string;
    subject_id: string;
    teacher_id: string;
    room_id: string;
    section_id: string;
    day_of_week: DayOfWeek;
    start_time: string;
    end_time: string;
    semester: string;
    academic_year: string;
    status: ScheduleStatus;
    created_at: string;
    updated_at: string;
    subject?: Subject;
    teacher?: Teacher;
    room?: Room;
    section?: Section;
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
