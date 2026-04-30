-- ============================================================================
-- SCHEDULING DATA EXPORT WITH RELATIONSHIPS
-- Exports all core scheduling data with relationships joined
-- Run this in Supabase SQL Editor to view all scheduling data
-- ============================================================================

-- ============================================================================
-- ALL USERS (Profiles)
-- ============================================================================
SELECT 
    id,
    email,
    full_name,
    role,
    department,
    program,
    year_level,
    section,
    avatar_url,
    created_at,
    updated_at
FROM public.profiles 
ORDER BY role, full_name;

-- ============================================================================
-- TEACHERS WITH PROFILES
-- ============================================================================
SELECT 
    t.id as teacher_id,
    t.department,
    t.employment_type,
    t.max_hours,
    t.current_load_percentage,
    t.is_active,
    p.id as profile_id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.program,
    p.section
FROM public.teachers t
LEFT JOIN public.profiles p ON t.profile_id = p.id
ORDER BY t.department, p.full_name;

-- ============================================================================
-- TEACHER PREFERENCES
-- ============================================================================
SELECT 
    tp.teacher_id,
    p.full_name as teacher_name,
    tp.preferred_days,
    tp.preferred_subjects,
    tp.preferred_rooms,
    tp.notes,
    tp.availability,
    tp.preferred_time_start,
    tp.preferred_time_end,
    tp.max_classes_per_day,
    tp.max_consecutive_classes,
    tp.last_updated,
    tp.created_at
FROM public.teacher_preferences tp
LEFT JOIN public.teachers t ON tp.teacher_id = t.id
LEFT JOIN public.profiles p ON t.profile_id = p.id
ORDER BY p.full_name;

-- ============================================================================
-- STUDENTS (Profiles with role = student)
-- ============================================================================
SELECT 
    id,
    email,
    full_name,
    program,
    year_level,
    section,
    avatar_url,
    created_at,
    updated_at
FROM public.profiles 
WHERE role = 'student'
ORDER BY program, year_level, section, full_name;

-- ============================================================================
-- SUBJECTS
-- ============================================================================
SELECT 
    id,
    name,
    code,
    units,
    type,
    duration_hours,
    program,
    year_level,
    requires_lab,
    teacher_id,
    weight,
    priority_note,
    owner_id,
    is_public,
    sessions_per_week,
    created_at
FROM public.subjects 
ORDER BY code, name;

-- ============================================================================
-- ROOMS
-- ============================================================================
SELECT 
    id,
    name,
    building,
    type,
    capacity,
    floor,
    equipment,
    is_available,
    weight,
    priority_note,
    owner_id,
    is_public,
    shared_with,
    created_at
FROM public.rooms 
ORDER BY building, name;

-- ============================================================================
-- SECTIONS WITH HIERARCHY
-- ============================================================================
SELECT 
    s.id as section_id,
    s.name as section_name,
    s.program,
    s.year_level,
    s.student_count,
    s.parent_id,
    s.path,
    s.node_type,
    s.is_active,
    s.weight,
    s.sort_order
FROM public.sections s
ORDER BY s.program, s.year_level, s.name;

-- ============================================================================
-- SCHEDULES WITH ALL RELATIONSHIPS
-- ============================================================================
SELECT 
    sch.id as schedule_id,
    sch.day_of_week,
    sch.start_time,
    sch.end_time,
    sch.semester,
    sch.academic_year,
    sch.status,
    sch.created_at,
    sch.updated_at,
    -- Subject
    sub.id as subject_id,
    sub.name as subject_name,
    sub.code as subject_code,
    -- Teacher
    t.id as teacher_id,
    t.profile_id,
    tp.full_name as teacher_name,
    tp.email as teacher_email,
    t.department as teacher_department,
    -- Room
    r.id as room_id,
    r.name as room_name,
    r.building as room_building,
    r.type as room_type,
    r.capacity as room_capacity,
    -- Section
    sec.id as section_id,
    sec.name as section_name,
    sec.program as section_program,
    sec.year_level as section_year_level,
    -- Creator
    p.id as created_by_id,
    p.full_name as created_by_name,
    p.email as created_by_email,
    -- Locking info
    sch.is_locked,
    sch.locked_by,
    sch.locked_at,
    -- Approval info
    sch.submitted_at,
    sch.approved_by,
    sch.approved_at,
    sch.rejected_by,
    sch.rejected_at,
    sch.rejection_reason
FROM public.schedules sch
LEFT JOIN public.subjects sub ON sch.subject_id = sub.id
LEFT JOIN public.teachers t ON sch.teacher_id = t.id
LEFT JOIN public.profiles tp ON t.profile_id = tp.id
LEFT JOIN public.rooms r ON sch.room_id = r.id
LEFT JOIN public.sections sec ON sch.section_id = sec.id
LEFT JOIN public.profiles p ON sch.created_by = p.id
ORDER BY sch.day_of_week, sch.start_time, sch.semester, sch.academic_year;

-- ============================================================================
-- CONFLICTS WITH DETAILS
-- ============================================================================
SELECT 
    c.id as conflict_id,
    c.type,
    c.severity,
    c.title,
    c.description,
    c.is_resolved,
    c.resolved_by,
    c.resolved_at,
    c.created_at,
    -- Schedule A
    s1.id as schedule_a_id,
    s1.day_of_week as schedule_a_day,
    s1.start_time as schedule_a_start,
    s1.end_time as schedule_a_end,
    sub1.name as subject_a_name,
    sub1.code as subject_a_code,
    t1.profile_id as teacher_a_id,
    tp1.full_name as teacher_a_name,
    r1.name as room_a_name,
    r1.building as room_a_building,
    sec1.name as section_a_name,
    sec1.program as section_a_program,
    -- Schedule B
    s2.id as schedule_b_id,
    s2.day_of_week as schedule_b_day,
    s2.start_time as schedule_b_start,
    s2.end_time as schedule_b_end,
    sub2.name as subject_b_name,
    sub2.code as subject_b_code,
    t2.profile_id as teacher_b_id,
    tp2.full_name as teacher_b_name,
    r2.name as room_b_name,
    r2.building as room_b_building,
    sec2.name as section_b_name,
    sec2.program as section_b_program
FROM public.conflicts c
LEFT JOIN public.schedules s1 ON c.schedule_a_id = s1.id
LEFT JOIN public.subjects sub1 ON s1.subject_id = sub1.id
LEFT JOIN public.teachers t1 ON s1.teacher_id = t1.id
LEFT JOIN public.profiles tp1 ON t1.profile_id = tp1.id
LEFT JOIN public.rooms r1 ON s1.room_id = r1.id
LEFT JOIN public.sections sec1 ON s1.section_id = sec1.id
LEFT JOIN public.schedules s2 ON c.schedule_b_id = s2.id
LEFT JOIN public.subjects sub2 ON s2.subject_id = sub2.id
LEFT JOIN public.teachers t2 ON s2.teacher_id = t2.id
LEFT JOIN public.profiles tp2 ON t2.profile_id = tp2.id
LEFT JOIN public.rooms r2 ON s2.room_id = r2.id
LEFT JOIN public.sections sec2 ON s2.section_id = sec2.id
ORDER BY c.is_resolved, c.created_at DESC;

-- ============================================================================
-- SUMMARY COUNTS
-- ============================================================================
SELECT 
    'SUMMARY' as report_type,
    'Total Users' as metric,
    COUNT(*) as count
FROM public.profiles
UNION ALL
SELECT 
    'SUMMARY',
    'Total Teachers',
    COUNT(*)
FROM public.teachers
UNION ALL
SELECT 
    'SUMMARY',
    'Total Students',
    COUNT(*)
FROM public.profiles
WHERE role = 'student'
UNION ALL
SELECT 
    'SUMMARY',
    'Total Subjects',
    COUNT(*)
FROM public.subjects
UNION ALL
SELECT 
    'SUMMARY',
    'Total Rooms',
    COUNT(*)
FROM public.rooms
UNION ALL
SELECT 
    'SUMMARY',
    'Total Sections',
    COUNT(*)
FROM public.sections
UNION ALL
SELECT 
    'SUMMARY',
    'Total Schedules',
    COUNT(*)
FROM public.schedules
UNION ALL
SELECT 
    'SUMMARY',
    'Published Schedules',
    COUNT(*)
FROM public.schedules
WHERE status = 'published'
UNION ALL
SELECT 
    'SUMMARY',
    'Active Conflicts',
    COUNT(*)
FROM public.conflicts
WHERE is_resolved = false;
