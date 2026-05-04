-- Fix subject_rooms with correct room IDs
-- Clear existing data
DELETE FROM subject_rooms;

-- Room IDs (from database - CORRECTED)
-- Physics Laboratory: 70e2f63a-7986-4207-8f4b-235f21b41201
-- Chemical Laboratory: 1b1d5c2b-87ba-46e8-a1c7-f7461e4fcbfa
-- Computer Laboratory: 743a0de9-ea24-4fc1-8ecb-f5980f7f52c9
-- P.E. Hall: 6a0cb139-5f68-4b9e-972c-c9af6b42450a
-- Kitchen: e126661d-01ea-420c-8cb4-7280a99136f8
-- Common rooms: dcfee31b-e47a-47ee-ab1b-ed4705fb4b27 (Room 101), 5673407e-70c5-42c8-be79-2af97fea92fe (Room 102), 9846cd29-bc02-4609-8673-4eaa0a232522 (Room 103), 73326486-d7c8-41da-9357-ec38463adc33 (Room 104), 73c9c4ef-9b70-43ce-b02c-b3ab0816ad2c (Room 105), 3ad76f5f-2f97-4ebb-a929-78e543895e0b (Room 106), 801549b2-ae6-4cea-b6de-0b348f6cb342 (Room 107), 55bdfaee-525b-4153-97c4-2f7c3ab302e5 (Amphitheater)

-- Special room mappings (subjects that require specific special rooms)
-- Physical Science -> Physics Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('6fbb64bd-19d4-4eeb-8fb1-ef6396538997', '70e2f63a-7986-4207-8f4b-235f21b41201', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Chemical Science -> Chemical Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('c4142401-c6ae-43a5-af73-203f3266bb3d', '1b1d5c2b-87ba-46e8-a1c7-f7461e4fcbfa', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Computer Programming 1 -> Computer Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('24620edb-80fa-4d3c-bda4-b7539086b784', '743a0de9-ea24-4fc1-8ecb-f5980f7f52c9', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Computer Programming 2 -> Computer Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('41cf59d7-0757-478c-b4a8-9b7b2b58ad45', '743a0de9-ea24-4fc1-8ecb-f5980f7f52c9', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Computer Programming 3 -> Computer Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('9e5a631d-05cd-4e2a-ac62-91be3a425729', '743a0de9-ea24-4fc1-8ecb-f5980f7f52c9', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Computer Programming 4 -> Computer Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('24acca38-0372-40cc-8296-db13a94bac90', '743a0de9-ea24-4fc1-8ecb-f5980f7f52c9', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Mobile Programming 1 -> Computer Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('77689bc1-93a1-4946-9069-741cc448026a', '743a0de9-ea24-4fc1-8ecb-f5980f7f52c9', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Mobile Programming 2 -> Computer Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('6ff69618-0a4f-4fea-8712-1f94913c8735', '743a0de9-ea24-4fc1-8ecb-f5980f7f52c9', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Physical Education and Health 1 -> P.E. Hall
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('ade2f977-106e-4909-aaba-15006f4f34f1', '6a0cb139-5f68-4b9e-972c-c9af6b42450a', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Physical Education and Health 2 -> P.E. Hall
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('95b172f9-077e-48d9-8dbc-47b71072b6e2', '6a0cb139-5f68-4b9e-972c-c9af6b42450a', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- General Chemistry 1 -> Chemical Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('8fec92cf-adb5-4d51-8dd6-b5b93fa05074', '1b1d5c2b-87ba-46e8-a1c7-f7461e4fcbfa', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- General Chemistry 2 -> Chemical Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('c9679ec4-9bea-4f2e-9125-e250f01596c2', '1b1d5c2b-87ba-46e8-a1c7-f7461e4fcbfa', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- General Physics 1 -> Physics Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('8d4c4937-a5f3-4ea1-b6a1-0e4a5dded693', '70e2f63a-7986-4207-8f4b-235f21b41201', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- General Physics 2 -> Physics Laboratory
INSERT INTO subject_rooms (subject_id, room_id, priority)
VALUES ('43e9ebd5-a7c8-4240-a2e0-8c2861d44528', '70e2f63a-7986-4207-8f4b-235f21b41201', 1)
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Common room mappings (all other subjects can use all common rooms)
-- Get all subject IDs that don't have special room requirements
WITH common_subjects AS (
    SELECT id FROM subjects
    WHERE id NOT IN (
        '6fbb64bd-19d4-4eeb-8fb1-ef6396538997', -- Physical Science
        'c4142401-c6ae-43a5-af73-203f3266bb3d', -- Chemical Science
        '24620edb-80fa-4d3c-bda4-b7539086b784', -- CP1
        '41cf59d7-0757-478c-b4a8-9b7b2b58ad45', -- CP2
        '9e5a631d-05cd-4e2a-ac62-91be3a425729', -- CP3
        '24acca38-0372-40cc-8296-db13a94bac90', -- CP4
        '77689bc1-93a1-4946-9069-741cc448026a', -- MP1
        '6ff69618-0a4f-4fea-8712-1f94913c8735', -- MP2
        'ade2f977-106e-4909-aaba-15006f4f34f1', -- PEH1
        '95b172f9-077e-48d9-8dbc-47b71072b6e2', -- PEH2
        '8fec92cf-adb5-4d51-8dd6-b5b93fa05074', -- GC1
        'c9679ec4-9bea-4f2e-9125-e250f01596c2', -- GC2
        '8d4c4937-a5f3-4ea1-b6a1-0e4a5dded693', -- GP1
        '43e9ebd5-a7c8-4240-a2e0-8c2861d44528'  -- GP2
    )
)
INSERT INTO subject_rooms (subject_id, room_id, priority)
SELECT cs.id, r.id, 1
FROM common_subjects cs
CROSS JOIN rooms r
WHERE r.type = 'common'
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Also allow special subjects to use common rooms as fallback (lower priority)
WITH special_subjects AS (
    SELECT id FROM subjects
    WHERE id IN (
        '6fbb64bd-19d4-4eeb-8fb1-ef6396538997', -- Physical Science
        'c4142401-c6ae-43a5-af73-203f3266bb3d', -- Chemical Science
        '24620edb-80fa-4d3c-bda4-b7539086b784', -- CP1
        '41cf59d7-0757-478c-b4a8-9b7b2b58ad45', -- CP2
        '9e5a631d-05cd-4e2a-ac62-91be3a425729', -- CP3
        '24acca38-0372-40cc-8296-db13a94bac90', -- CP4
        '77689bc1-93a1-4946-9069-741cc448026a', -- MP1
        '6ff69618-0a4f-4fea-8712-1f94913c8735', -- MP2
        'ade2f977-106e-4909-aaba-15006f4f34f1', -- PEH1
        '95b172f9-077e-48d9-8dbc-47b71072b6e2', -- PEH2
        '8fec92cf-adb5-4d51-8dd6-b5b93fa05074', -- GC1
        'c9679ec4-9bea-4f2e-9125-e250f01596c2', -- GC2
        '8d4c4937-a5f3-4ea1-b6a1-0e4a5dded693', -- GP1
        '43e9ebd5-a7c8-4240-a2e0-8c2861d44528'  -- GP2
    )
)
INSERT INTO subject_rooms (subject_id, room_id, priority)
SELECT ss.id, r.id, 2
FROM special_subjects ss
CROSS JOIN rooms r
WHERE r.type = 'common'
ON CONFLICT (subject_id, room_id) DO NOTHING;

-- Verify the mappings
SELECT s.name as subject, r.name as room, r.type as room_type, sr.priority
FROM subject_rooms sr
JOIN subjects s ON sr.subject_id = s.id
JOIN rooms r ON sr.room_id = r.id
WHERE s.name IN ('Physical Science', 'General Physics 1', 'Physical Education and Health 1', 'Computer Programming 1', 'Mobile Programming 1')
ORDER BY s.name, r.type, sr.priority;
