-- Update teacher_eligibility_pool to include both Reneil and Angelica
-- This allows the generator to use both teachers for load balancing

-- Teacher IDs
-- Reneil P. Arnado: aa846fa8-bebd-4371-99d0-e1f16e14dbce
-- Angelica Marie R. Garcia: 7cce3e82-aa3f-4ac2-a884-be71efc51764

-- Update subjects to include both teachers in teacher_eligibility_pool (jsonb format)
UPDATE subjects
SET teacher_eligibility_pool = '["aa846fa8-bebd-4371-99d0-e1f16e14dbce", "7cce3e82-aa3f-4ac2-a884-be71efc51764"]'::jsonb
WHERE code IN ('ABM', 'APECON', 'BESR', 'ELEC', 'ENTREP', 'MIL', 'ROBO', 'UCSP');

-- Verify the changes
SELECT code, name, teacher_eligibility_pool 
FROM subjects 
WHERE code IN ('ABM', 'APECON', 'BESR', 'ELEC', 'ENTREP', 'MIL', 'ROBO', 'UCSP')
ORDER BY code;
