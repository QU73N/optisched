-- Migrate schedules from habana.123456@optisched.sti.edu to edgar.habana@optisched.sti.edu

-- Get the profile IDs
DO $$
DECLARE
  duplicate_id uuid;
  primary_id uuid;
  rows_updated integer;
BEGIN
  SELECT id INTO duplicate_id FROM profiles WHERE email = 'habana.123456@optisched.sti.edu' LIMIT 1;
  SELECT id INTO primary_id FROM profiles WHERE email = 'edgar.habana@optisched.sti.edu' LIMIT 1;
  
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
SELECT email, full_name FROM profiles WHERE email LIKE '%habana%';
