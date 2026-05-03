-- Check if subject_teachers table exists
SELECT 
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'subject_teachers'
    ) as table_exists;

-- If it exists, show its structure
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_teachers') THEN
        RAISE NOTICE 'Table subject_teachers exists';
    ELSE
        RAISE NOTICE 'Table subject_teachers does not exist';
    END IF;
END $$;

-- Show columns if table exists
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'subject_teachers'
ORDER BY ordinal_position;

-- Show existing data
SELECT * FROM public.subject_teachers LIMIT 10;
