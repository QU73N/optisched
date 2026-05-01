-- Assign teachers to subjects based on requirements

-- Get teacher IDs
DO $$
DECLARE
    reneil_id UUID;
    bea_id UUID;
    ello_id UUID;
    edgar_id UUID;
    john_id UUID;
    psalmmiracle_id UUID;
    mary_id UUID;
    mark_id UUID;
BEGIN
    SELECT t.id INTO reneil_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'reneil.arnado@optisched.sti.edu';
    SELECT t.id INTO bea_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'bea.magno@optisched.sti.edu';
    SELECT t.id INTO ello_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'ello.egnacio@optisched.sti.edu';
    SELECT t.id INTO edgar_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'edgar.habana@optisched.sti.edu';
    SELECT t.id INTO john_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'john.calizon@optisched.sti.edu';
    SELECT t.id INTO psalmmiracle_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'psalmmiracle.mariano@optisched.sti.edu';
    SELECT t.id INTO mary_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'mary.balando@optisched.sti.edu';
    SELECT t.id INTO mark_id FROM public.teachers t JOIN public.profiles p ON t.profile_id = p.id WHERE p.email = 'mark.doblon@optisched.sti.edu';
    
    -- Assign Reneil (Business)
    UPDATE public.subjects SET teacher_id = reneil_id WHERE code IN ('ENTREP', 'MIL', 'ABM', 'BESR', 'APECON');
    
    -- Assign Bea (Math)
    UPDATE public.subjects SET teacher_id = bea_id WHERE code IN ('STAT', 'CALC');
    
    -- Assign Ello (Research/Immersion)
    UPDATE public.subjects SET teacher_id = ello_id WHERE code IN ('UCSP', 'WI', 'PR1', 'III');
    
    -- Assign Edgar (Arts & PE)
    UPDATE public.subjects SET teacher_id = edgar_id WHERE code IN ('CPAR', 'PEH1', 'PEH2');
    
    -- Assign John (Computer Science)
    UPDATE public.subjects SET teacher_id = john_id WHERE code IN ('CP1', 'CP2', 'CP3', 'CP4', 'ELEC', 'ROBO', 'ET-ABM', 'ET-ICT', 'ET-STEM');
    
    -- Assign Psalmmiracle (Mobile Programming)
    UPDATE public.subjects SET teacher_id = psalmmiracle_id WHERE code IN ('MP1', 'MP2');
    
    -- Assign Mary (Physics)
    UPDATE public.subjects SET teacher_id = mary_id WHERE code IN ('PHYS12', 'GP1', 'GP2');
    
    -- Assign Mark (Chemistry)
    UPDATE public.subjects SET teacher_id = mark_id WHERE code IN ('CHEM11', 'GC1', 'GC2');
    
    RAISE NOTICE 'Teachers assigned to subjects';
END $$;

-- Verification
SELECT s.code, s.name, s.program, p.full_name as teacher_name, t.department
FROM public.subjects s
LEFT JOIN public.teachers t ON s.teacher_id = t.id
LEFT JOIN public.profiles p ON t.profile_id = p.id
ORDER BY s.program, s.year_level, s.code;
