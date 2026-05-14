// Dashboard-specific TypeScript interfaces

// Dashboard-specific Schedule interface (simplified for dashboard use)
export interface DashboardSchedule {
    id: string;
    day_of_week: string;
    start_time: string;
    end_time: string;
    status: 'published' | 'draft';
    subject?: { name: string };
    section?: { name: string };
    teacher?: {
        full_name: string;
        profile?: { full_name: string };
    };
    room_id?: string;
}

// Dashboard-specific Room interface (simplified for dashboard use)
export interface DashboardRoom {
    id: string;
    name: string;
}

// Dashboard-specific Section interface (simplified for dashboard use)
export interface DashboardSection {
    name: string;
}

// Dashboard-specific Conflict interface (simplified for dashboard use)
export interface DashboardConflict {
    id: string;
    created_at: string;
    is_resolved: boolean;
}

// Dashboard-specific Profile interface (simplified for dashboard use)
export interface DashboardProfile {
    id: string;
    full_name: string;
    role: string;
    email?: string;
}

export interface Announcement {
    id: string;
    title: string;
    content: string;
    priority: 'normal' | 'important';
    target_section: string;
    created_at: string;
    author_id?: string;
    author_name?: string;
}

export interface ChangeRequest {
    id: string;
    request_type: 'reschedule' | 'cancel' | 'swap';
    reason: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_notes: string | null;
    created_at: string;
    teacher_id: string;
    teacher_name?: string;
}

export interface CustomEvent {
    id: string;
    title: string;
    description: string;
    event_date: string;
    start_time: string;
    end_time: string;
    room_name: string | null;
    created_by: string;
}

export interface AdminMessage {
    id: string;
    message: string;
    sender_id: string;
    sender_name: string;
    recipient_id: string | null;
    direction: 'teacher_to_admin' | 'admin_to_teacher';
    created_at: string;
}

export interface ResetRequest {
    id: string;
    email: string;
    user_id?: string;
    status: 'pending' | 'approved' | 'denied';
    requested_at: string;
    resolved_at?: string;
    resolved_by?: string;
}

export interface DayLoad {
    day: string;
    count: number;
    isToday?: boolean;
}

export interface RoomLoad {
    name: string;
    count: number;
}

export interface ConflictsTrend {
    date: string;
    count: number;
}

export interface RequestFunnel {
    approved: number;
    rejected: number;
    pending: number;
}

export interface DashboardStats {
    totalUsers: number;
    teachers: number;
    students: number;
    schedules: number;
    conflicts: number;
    rooms: number;
}

export interface DashboardDeltas {
    schedules: number;
    conflicts: number;
    requests: number;
}
