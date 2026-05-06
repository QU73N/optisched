-- Update all existing schedule version snapshots to ensure they have foreign key IDs
-- This fixes the issue where old versions don't have subject_id, teacher_id, room_id, section_id

-- First, check which snapshots are missing IDs
DO $$
DECLARE
    v_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_record IN 
        SELECT id, snapshot 
        FROM schedule_versions 
        WHERE snapshot IS NOT NULL
    LOOP
        -- Check if snapshot has the required fields
        -- If not, we need to fetch the actual schedule data and update the snapshot
        -- This is a complex operation that requires fetching from schedules table
        
        -- For now, just report the issue
        IF NOT EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(v_record.snapshot) as item 
            WHERE item->>'subject_id' IS NOT NULL 
            AND item->>'teacher_id' IS NOT NULL 
            AND item->>'room_id' IS NOT NULL 
            AND item->>'section_id' IS NOT NULL
            LIMIT 1
        ) THEN
            RAISE NOTICE 'Version % has snapshots missing foreign key IDs', v_record.id;
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Found % versions with snapshots missing foreign key IDs', v_count;
    ELSE
        RAISE NOTICE 'All version snapshots have foreign key IDs';
    END IF;
END $$;

-- Alternative approach: Update snapshots by joining with actual schedules
-- This is more reliable but requires the schedules to still exist in the database
UPDATE schedule_versions v
SET snapshot = (
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'subject_id', s.subject_id,
            'teacher_id', s.teacher_id,
            'room_id', s.room_id,
            'section_id', s.section_id,
            'day_of_week', s.day_of_week,
            'start_time', s.start_time,
            'end_time', s.end_time,
            'status', s.status,
            'semester', s.semester,
            'academic_year', s.academic_year,
            'batch_id', s.batch_id
        )
    )
    FROM schedules s
    WHERE s.batch_id = v.batch_id
    AND s.status = v.change_type
    AND s.is_active = v.is_active
)
WHERE snapshot IS NOT NULL
AND EXISTS (
    SELECT 1 
    FROM jsonb_array_elements(snapshot) as item 
    WHERE item->>'subject_id' IS NULL 
    OR item->>'teacher_id' IS NULL 
    OR item->>'room_id' IS NULL 
    OR item->>'section_id' IS NULL
    LIMIT 1
);

-- Verify the update
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM schedule_versions 
    WHERE snapshot IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(snapshot) as item 
        WHERE item->>'subject_id' IS NOT NULL 
        AND item->>'teacher_id' IS NOT NULL 
        AND item->>'room_id' IS NOT NULL 
        AND item->>'section_id' IS NOT NULL
        LIMIT 1
    );
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Still have % versions with snapshots missing IDs after update', v_count;
    ELSE
        RAISE NOTICE 'All version snapshots now have foreign key IDs';
    END IF;
END $$;
