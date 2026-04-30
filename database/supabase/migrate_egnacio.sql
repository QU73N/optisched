-- Migrate schedules from egnacio.123456@meycauayan.sti.edu to ello.egnacio@optisched.sti.edu

DO $$
DECLARE
  duplicate_id uuid;
  primary_id uuid;
  rows_updated integer;
BEGIN
  SELECT id INTO duplicate_id FROM profiles WHERE email = 'egnacio.123456@meycauayan.sti.edu.ph' LIMIT 1;
  SELECT id INTO primary_id FROM profiles WHERE email = 'ello.egnacio@optisched.sti.edu' LIMIT 1;
  
  RAISE NOTICE 'Duplicate ID: %, Primary ID: %', duplicate_id, primary_id;
  
  -- Update schedules to point to primary account
  UPDATE schedules SET created_by = primary_id WHERE created_by = duplicate_id;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  RAISE NOTICE 'Migrated % schedules', rows_updated;
  
  -- Now delete the duplicate profile
  DELETE FROM profiles WHERE id = duplicate_id;
  
  RAISE NOTICE 'Deleted duplicate profile';
END $$;

-- Verify
SELECT email, full_name FROM profiles WHERE email LIKE '%egnacio%';
