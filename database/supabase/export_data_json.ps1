# Export scheduling data to JSON files (clean format)
$baseDir = "database\supabase\exports"
New-Item -ItemType Directory -Force -Path $baseDir | Out-Null

# Export profiles
Write-Host "Exporting profiles..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT id, email, full_name, role, department, program, year_level, section, avatar_url, created_at, updated_at FROM public.profiles ORDER BY role, full_name) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\profiles.json" -Encoding UTF8 -NoNewline

# Export teachers with profiles
Write-Host "Exporting teachers..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT t.id as teacher_id, t.department, t.employment_type, t.max_hours, t.current_load_percentage, t.is_active, p.id as profile_id, p.email, p.full_name, p.avatar_url, p.program, p.section FROM public.teachers t LEFT JOIN public.profiles p ON t.profile_id = p.id ORDER BY t.department, p.full_name) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\teachers.json" -Encoding UTF8 -NoNewline

# Export teacher preferences
Write-Host "Exporting teacher preferences..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT tp.teacher_id, p.full_name as teacher_name, tp.preferred_days, tp.preferred_subjects, tp.preferred_rooms, tp.notes, tp.availability, tp.preferred_time_start, tp.preferred_time_end, tp.max_classes_per_day, tp.max_consecutive_classes, tp.last_updated, tp.created_at FROM public.teacher_preferences tp LEFT JOIN public.teachers t ON tp.teacher_id = t.id LEFT JOIN public.profiles p ON t.profile_id = p.id ORDER BY p.full_name) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\teacher_preferences.json" -Encoding UTF8 -NoNewline

# Export students
Write-Host "Exporting students..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT id, email, full_name, program, year_level, section, avatar_url, created_at FROM public.profiles WHERE role = 'student' ORDER BY program, year_level, section, full_name) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\students.json" -Encoding UTF8 -NoNewline

# Export subjects
Write-Host "Exporting subjects..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT id, name, code, units, type, duration_hours, program, year_level, requires_lab, teacher_id, weight, priority_note, is_public, sessions_per_week, created_at FROM public.subjects ORDER BY code, name) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\subjects.json" -Encoding UTF8 -NoNewline

# Export rooms
Write-Host "Exporting rooms..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT id, name, building, type, capacity, floor, equipment, is_available, weight, priority_note, is_public, created_at FROM public.rooms ORDER BY building, name) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\rooms.json" -Encoding UTF8 -NoNewline

# Export sections
Write-Host "Exporting sections..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT s.id as section_id, s.name as section_name, s.program, s.year_level, s.student_count, s.parent_id, s.path, s.node_type, s.is_active, s.weight, s.sort_order FROM public.sections s ORDER BY s.program, s.year_level, s.name) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\sections.json" -Encoding UTF8 -NoNewline

# Export schedules with relationships
Write-Host "Exporting schedules..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT sch.id as schedule_id, sch.day_of_week, sch.start_time, sch.end_time, sch.semester, sch.academic_year, sch.status, sch.created_at, sub.id as subject_id, sub.name as subject_name, sub.code as subject_code, t.id as teacher_id, t.profile_id, tp.full_name as teacher_name, tp.email as teacher_email, t.department as teacher_department, r.id as room_id, r.name as room_name, r.building as room_building, r.type as room_type, r.capacity as room_capacity, sec.id as section_id, sec.name as section_name, sec.program as section_program, sec.year_level as section_year_level FROM public.schedules sch LEFT JOIN public.subjects sub ON sch.subject_id = sub.id LEFT JOIN public.teachers t ON sch.teacher_id = t.id LEFT JOIN public.profiles tp ON t.profile_id = tp.id LEFT JOIN public.rooms r ON sch.room_id = r.id LEFT JOIN public.sections sec ON sch.section_id = sec.id ORDER BY sch.day_of_week, sch.start_time) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\schedules.json" -Encoding UTF8 -NoNewline

# Export conflicts
Write-Host "Exporting conflicts..."
$query = "SELECT json_agg(row_to_json(t)) FROM (SELECT c.id as conflict_id, c.type, c.severity, c.title, c.description, c.is_resolved, c.resolved_by, c.resolved_at, c.created_at FROM public.conflicts c ORDER BY c.is_resolved, c.created_at DESC) t"
$result = npx supabase db query $query --linked 2>&1 | Select-Object -Skip 2 | Select-Object -SkipLast 1
$result | Out-File "$baseDir\conflicts.json" -Encoding UTF8 -NoNewline

Write-Host "Export complete! Files saved to $baseDir"
