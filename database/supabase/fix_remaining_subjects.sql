-- ============================================================================
-- FIX REMAINING SUBJECT PROGRAM ASSIGNMENTS
-- ============================================================================

-- ET-STEM should be Science (no STEM teacher department)
UPDATE subjects SET program = 'Science' WHERE code = 'ET-STEM';

-- Statistics and Probability should be Mathematics
UPDATE subjects SET program = 'Mathematics' WHERE code = 'STAT';

-- Entrepreneurship should be Business
UPDATE subjects SET program = 'Business' WHERE code = 'ENTREP';

-- ============================================================================
-- VERIFICATION - SHOW UPDATED SUBJECTS
-- ============================================================================

SELECT 
    sub.id,
    sub.name,
    sub.code,
    sub.program
FROM subjects sub
ORDER BY sub.program, sub.name;
