-- Check subject_teachers junction table
SELECT 
    st.teacher_id,
    p.full_name,
    COUNT(DISTINCT st.subject_id) as subject_count
FROM subject_teachers st
JOIN teachers t ON st.teacher_id = t.id
JOIN profiles p ON t.profile_id = p.id
GROUP BY st.teacher_id, p.full_name
ORDER BY p.full_name;
