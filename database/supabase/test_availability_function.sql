-- ============================================================================
-- TEST AVAILABILITY FUNCTION
-- ============================================================================
-- This script tests the generate_availability_map function with various inputs
-- ============================================================================

-- Test 1: Saturday only, 8AM-5PM
SELECT 
    'TEST 1: Saturday Only 8AM-5PM' as test_name,
    generate_availability_map(
        ARRAY['Saturday']::text[],
        '08:00',
        '17:00'
    ) as result;

-- Test 2: Weekend only (Sat-Sun), 8AM-5PM
SELECT 
    'TEST 2: Weekend Only 8AM-5PM' as test_name,
    generate_availability_map(
        ARRAY['Saturday', 'Sunday']::text[],
        '08:00',
        '17:00'
    ) as result;

-- Test 3: Weekdays only, 8AM-5PM
SELECT 
    'TEST 3: Weekdays Only 8AM-5PM' as test_name,
    generate_availability_map(
        ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[],
        '08:00',
        '17:00'
    ) as result;

-- Test 4: Full week, 7AM-6PM
SELECT 
    'TEST 4: Full Week 7AM-6PM' as test_name,
    generate_availability_map(
        ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']::text[],
        '07:00',
        '18:00'
    ) as result;

-- Test 5: Check key count for each test
SELECT 
    'TEST 5: Key Counts' as test_name,
    jsonb_object_keys(generate_availability_map(ARRAY['Saturday']::text[], '08:00', '17:00')) as saturday_keys,
    (SELECT COUNT(*) FROM jsonb_object_keys(generate_availability_map(ARRAY['Saturday']::text[], '08:00', '17:00'))) as saturday_count,
    jsonb_object_keys(generate_availability_map(ARRAY['Saturday', 'Sunday']::text[], '08:00', '17:00')) as weekend_keys,
    (SELECT COUNT(*) FROM jsonb_object_keys(generate_availability_map(ARRAY['Saturday', 'Sunday']::text[], '08:00', '17:00'))) as weekend_count,
    jsonb_object_keys(generate_availability_map(ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[], '08:00', '17:00')) as weekday_keys,
    (SELECT COUNT(*) FROM jsonb_object_keys(generate_availability_map(ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']::text[], '08:00', '17:00'))) as weekday_count;
