-- Comprehensive schema consistency check
-- Run this in Supabase SQL Editor to compare actual DB with canonical schema

-- Get all tables with their columns
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name NOT LIKE 'pg_%'
ORDER BY table_name, ordinal_position;
