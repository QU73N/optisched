-- ============================================================================
-- UPDATE ALL ROOMS TO MAIN BUILDING
-- ============================================================================
-- This script updates all rooms in the database to have building = 'Main Building'
-- This consolidates all rooms into a single building for simplified management
-- ============================================================================

-- First, show current building distribution
SELECT 
    'CURRENT BUILDING DISTRIBUTION' as report,
    building,
    COUNT(*) as room_count
FROM public.rooms
GROUP BY building
ORDER BY building;

-- Show sample of current rooms before update
SELECT 
    'SAMPLE ROOMS BEFORE UPDATE' as report,
    id,
    name,
    building,
    type,
    capacity,
    floor
FROM public.rooms
LIMIT 10;

-- ============================================================================
-- UPDATE ALL ROOMS TO MAIN BUILDING
-- ============================================================================

-- Update all rooms to have building = 'Main Building'
UPDATE public.rooms
SET building = 'Main Building'
WHERE building IS NULL OR building != 'Main Building';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all rooms now have Main Building
SELECT 
    'VERIFICATION: BUILDING DISTRIBUTION AFTER UPDATE' as report,
    building,
    COUNT(*) as room_count
FROM public.rooms
GROUP BY building;

-- Verify no rooms have NULL building
SELECT 
    'VERIFICATION: ROOMS WITH NULL BUILDING' as report,
    COUNT(*) as null_building_count
FROM public.rooms
WHERE building IS NULL;

-- Show sample of rooms after update
SELECT 
    'SAMPLE ROOMS AFTER UPDATE' as report,
    id,
    name,
    building,
    type,
    capacity,
    floor
FROM public.rooms
LIMIT 10;

-- Total room count
SELECT 
    'TOTAL ROOM COUNT' as report,
    COUNT(*) as total_rooms
FROM public.rooms;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT 
    'UPDATE SUMMARY' as report,
    'All rooms have been updated to Main Building' as message,
    COUNT(*) as total_rooms_updated
FROM public.rooms
WHERE building = 'Main Building';
