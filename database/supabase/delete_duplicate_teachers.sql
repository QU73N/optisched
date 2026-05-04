-- ============================================================
-- Delete Duplicate Teacher Records
-- ============================================================
-- This script deletes teacher records that are duplicates
-- (same name) but have no subjects assigned to them.
-- The duplicates without subjects are the incomplete records.
-- ============================================================

-- DELETE Bea Angely Magno duplicates (keep 56064537-cd79-47aa-915d-b94058417f7e which has 2 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = 'a9ec4e1a-d43e-4e25-ae05-3b670c63a25f';
DELETE FROM teachers WHERE id = 'a9ec4e1a-d43e-4e25-ae05-3b670c63a25f';
DELETE FROM teacher_preferences WHERE teacher_id = 'c265c70f-a2e8-4880-97fc-6846730a3f08';
DELETE FROM teachers WHERE id = 'c265c70f-a2e8-4880-97fc-6846730a3f08';

-- DELETE Edgar Habana duplicates (keep 7949b2d0-4c7c-4849-b6f5-17a78ce1c1a8 which has 3 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = '98ea90ab-0537-4887-873c-2f6c59a6a753';
DELETE FROM teachers WHERE id = '98ea90ab-0537-4887-873c-2f6c59a6a753';
DELETE FROM teacher_preferences WHERE teacher_id = 'cef87f3d-8704-4082-8b9a-d6ae4a351da8';
DELETE FROM teachers WHERE id = 'cef87f3d-8704-4082-8b9a-d6ae4a351da8';

-- DELETE Ello Jr., Egnacio Y. duplicates (keep bbc91167-72c7-4244-9b4d-27efbe79f4c3 which has 3 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = '4c25fa94-ca86-4d59-aab5-3a32636e0125';
DELETE FROM teachers WHERE id = '4c25fa94-ca86-4d59-aab5-3a32636e0125';
DELETE FROM teacher_preferences WHERE teacher_id = 'a14a0bc1-e32d-4dd5-9f0d-e7e79224445b';
DELETE FROM teachers WHERE id = 'a14a0bc1-e32d-4dd5-9f0d-e7e79224445b';

-- DELETE John Michael Calizon duplicates (keep ad94a951-40b4-4c52-acc2-738eee2a805a which has 7 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = 'a3b4c623-25fd-415d-867c-292fd4eb098f';
DELETE FROM teachers WHERE id = 'a3b4c623-25fd-415d-867c-292fd4eb098f';
DELETE FROM teacher_preferences WHERE teacher_id = 'f21fedbc-db57-4e52-a5e1-48131279caa8';
DELETE FROM teachers WHERE id = 'f21fedbc-db57-4e52-a5e1-48131279caa8';

-- DELETE Mark Gerald Doblon duplicates (keep bc211fd8-9917-4114-af3c-6b4694a9cc1c which has 3 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = 'd6c1f2e5-3b21-4ef9-9ca5-1d79ae1998e6';
DELETE FROM teachers WHERE id = 'd6c1f2e5-3b21-4ef9-9ca5-1d79ae1998e6';

-- DELETE Mary Jane Balando duplicates (keep 31c5a71a-a5f6-4203-b262-2d603351f5d2 which has 3 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = 'a2f11c38-f3f2-41d5-878f-7734aef93c42';
DELETE FROM teachers WHERE id = 'a2f11c38-f3f2-41d5-878f-7734aef93c42';

-- DELETE Psalmmiracle Pineda Mariano duplicates (keep ffcc2c0a-9c1d-49b1-b248-9e42f3414c4d which has 2 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = 'f480b410-db9a-44d3-a11a-f45f9a721d09';
DELETE FROM teachers WHERE id = 'f480b410-db9a-44d3-a11a-f45f9a721d09';
DELETE FROM teacher_preferences WHERE teacher_id = '308901f7-59ec-4e38-bb7d-c2cdbac8f232';
DELETE FROM teachers WHERE id = '308901f7-59ec-4e38-bb7d-c2cdbac8f232';

-- DELETE Reneil P. Arnado duplicates (keep aa846fa8-bebd-4371-99d0-e1f16e14dbce which has 8 subjects)
DELETE FROM teacher_preferences WHERE teacher_id = 'ec1a8e6c-0142-4a75-95f8-9c02e4595fdd';
DELETE FROM teachers WHERE id = 'ec1a8e6c-0142-4a75-95f8-9c02e4595fdd';
DELETE FROM teacher_preferences WHERE teacher_id = 'f3fa39f2-5ba4-4222-af3d-e0adac0b640e';
DELETE FROM teachers WHERE id = 'f3fa39f2-5ba4-4222-af3d-e0adac0b640e';

-- DELETE Mira Mariano (no subjects, appears to be incomplete/test record)
DELETE FROM teacher_preferences WHERE teacher_id = '6bee44fe-9d2a-484b-b243-9cb96ac1b070';
DELETE FROM teachers WHERE id = '6bee44fe-9d2a-484b-b243-9cb96ac1b070';

-- DELETE STEM Teacher 1 (no subjects, appears to be incomplete/test record)
DELETE FROM teacher_preferences WHERE teacher_id = 'cef87f3d-8704-4082-8b9a-d6ae4a351da8';
DELETE FROM teachers WHERE id = 'cef87f3d-8704-4082-8b9a-d6ae4a351da8';
