-- Check detailed schedules for the top teacher
SELECT 
    id,
    section_id,
    day_of_week,
    start_time,
    end_time,
    subject_id,
    status,
    is_active
FROM public.schedules
WHERE teacher_id = 'bbc91167-72c7-4244-9b4d-27efbe79f4c3'
AND is_active = true
ORDER BY day_of_week, start_time;
