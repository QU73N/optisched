// TypeScript interfaces for all database entities
// Strict types — no `any` allowed per project requirements

// ============ Auth & Profiles ============

export type UserRole = 'admin' | 'teacher' | 'student';
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

// ============ Teachers ============

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
    // Joined fields
    profile?: Profile;
}

// ============ Rooms ============

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

// ============ Subjects ============

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

// ============ Sections ============

export interface Section {
    id: string;
    name: string;
    program: string;
    year_level: number;
    student_count: number;
    created_at: string;
}

// ============ Schedules ============

export interface Schedule {
    id: string;
    subject_id: string;
    teacher_id: string;
    room_id: string;
    section_id: string;
    day_of_week: DayOfWeek;
    start_time: string; // HH:MM format
    end_time: string;   // HH:MM format
    semester: string;
    academic_year: string;
    status: ScheduleStatus;
    created_at: string;
    updated_at: string;
    // Joined fields
    subject?: Subject;
    teacher?: Teacher;
    room?: Room;
    section?: Section;
}

// ============ Teacher Preferences ============

export interface TeacherPreference {
    id: string;
    teacher_id: string;
    preferred_days: DayOfWeek[];
    morning_available: boolean;
    afternoon_available: boolean;
    evening_available: boolean;
    preferred_subjects: string[];
    preferred_rooms: string[];
    max_consecutive_hours: number;
    notes: string | null;
    last_updated: string;
    created_at: string;
}

// ============ Conflicts ============

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
    // Joined
    schedule_a?: Schedule;
    schedule_b?: Schedule;
}

// ============ Admin Tasks ============

export interface AdminTask {
    id: string;
    title: string;
    description: string;
    priority: TaskPriority;
    progress: number; // 0-100
    status: TaskStatus;
    assigned_to: string[];
    department: string | null;
    due_date: string | null;
    created_at: string;
    updated_at: string;
}

// ============ Chat Messages ============

export interface ChatMessage {
    id: string;
    user_id: string;
    content: string;
    is_bot: boolean;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

// ============ App Settings ============

export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    notifications_schedule: boolean;
    notifications_assignments: boolean;
    google_calendar_connected: boolean;
    two_factor_enabled: boolean;
}

// ============ Constraint Settings ============

export interface ConstraintSettings {
    block_rest_days: boolean;
    force_lunch_break: boolean;
    max_consecutive_hours: number;
    standard_lab_capacity: number;
    standard_lecture_capacity: number;
    allow_overflow: boolean;
    overflow_percentage: number;
    subject_constraints: SubjectConstraint[];
}

export interface SubjectConstraint {
    id: string;
    subject_category: string;
    required_room_type: RoomType;
    icon: string;
    color: string;
}

// ============ Dashboard Stats ============

export interface AdminDashboardStats {
    conflict_free_percentage: number;
    room_utilization: number;
    load_balance: number;
    active_semester: string;
    academic_year: string;
    status: 'published' | 'draft';
}

export interface TeacherDashboardStats {
    classes_today: number;
    total_units: number;
    conflicts: number;
    current_week: number;
}

export interface StudentDashboardStats {
    classes_today: number;
    current_class: Schedule | null;
    next_class: Schedule | null;
}
