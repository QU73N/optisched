-- ============================================================================
-- LIST ALL TEACHERS WITH DETAILS
-- ============================================================================

SELECT 
    t.id,
    p.full_name,
    p.email,
    t.department,
    t.employment_type,
    t.max_hours,
    t.is_active,
    tp.preferred_days,
    tp.preferred_time_start,
    tp.preferred_time_end,
    tp.max_classes_per_day
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
LEFT JOIN teacher_preferences tp ON t.id = tp.teacher_id
ORDER BY t.employment_type, p.full_name;
