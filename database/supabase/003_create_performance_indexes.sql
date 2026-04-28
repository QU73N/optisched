-- =====================================================================
-- Performance Indexes for Common Query Patterns
-- Idempotent — safe to re-run.
-- =====================================================================

-- User activity logs
CREATE INDEX IF NOT EXISTS ix_user_activity_logs_user_created
    ON user_activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_user_activity_logs_action_created
    ON user_activity_logs(action_type, created_at DESC);

-- Audit logs
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_created
    ON audit_logs(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_audit_logs_action_created
    ON audit_logs(action, created_at DESC);

-- Schedules
CREATE INDEX IF NOT EXISTS ix_schedules_status_updated
    ON schedules(status, updated_at DESC)
    WHERE status IN ('draft','published','archived');

CREATE INDEX IF NOT EXISTS ix_schedules_academic_year
    ON schedules(academic_year, semester);

-- Sections
CREATE INDEX IF NOT EXISTS ix_sections_program_year
    ON sections(program, year_level);

-- Change requests
CREATE INDEX IF NOT EXISTS ix_schedule_change_requests_status
    ON schedule_change_requests(status, created_at DESC)
    WHERE status IN ('pending','approved','rejected');

CREATE INDEX IF NOT EXISTS ix_schedule_change_requests_teacher
    ON schedule_change_requests(teacher_id, created_at DESC);

-- Conflicts
CREATE INDEX IF NOT EXISTS ix_conflicts_resolved
    ON conflicts(is_resolved, created_at DESC);

-- Announcements
CREATE INDEX IF NOT EXISTS ix_announcements_priority_dates
    ON announcements(priority, created_at DESC);

