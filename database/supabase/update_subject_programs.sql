-- Update subjects to use ALL for programs that apply to all sections
-- Core and Applied subjects that apply to all programs

-- Core subjects (apply to all programs)
UPDATE public.subjects SET program = 'ALL' WHERE code IN ('MIL', 'UCSP', 'PR1', 'III', 'WI', 'PEH1', 'PEH2', 'CPAR');

-- Verification
SELECT code, name, program, year_level FROM public.subjects WHERE program = 'ALL' ORDER BY code;
