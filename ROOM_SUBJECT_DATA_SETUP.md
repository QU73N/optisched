# Room, Subject, and Teacher Data Setup

## Room Management Requirements

### 10.1 Room Types
- **Common rooms:** Rooms wherein any subject can be taught. These are general-purpose classrooms without specialized equipment.
- **Special rooms:** Rooms that have equipment a specific subject needs (e.g., computer labs, science labs, studios, workshops). These are reserved preferentially for subjects that require them.
- **Hard constraint:** Special subjects (subjects with `requires_lab = true` or marked as requiring special equipment) can only be assigned to special rooms.
- **Soft constraint:** Special rooms are less likely to be used by common subjects (subjects that don't need special rooms). This maximizes room availability for subjects that actually require the specialized equipment.
- When conflicts exist, the scheduler prioritizes special subjects for special rooms, leaving common rooms available for general use.

### 10.2 Room Constraints
- **Hard constraint:** Room capacity must always be greater than or equal to section size
- **Hard constraint:** Only one section may occupy a room during a given session

### 10.3 Room Details
- Building
- Floor
- Room number
- Capacity
- These details are needed for soft constraint optimization (room movement and walking distance)

### 10.4 Room Optimization
- **Soft optimization goal:** Attempt to minimize unnecessary movement between buildings and floors

## Rooms Created ✓

**Common Rooms:**
- Room 101 - Main Building, Floor 2, Capacity 30
- Room 102 - Main Building, Floor 2, Capacity 30
- Room 103 - Main Building, Floor 2, Capacity 30
- Room 104 - Main Building, Floor 2, Capacity 30
- Room 105 - Main Building, Floor 2, Capacity 30
- Room 106 - Main Building, Floor 2, Capacity 30
- Room 107 - Main Building, Floor 2, Capacity 30
- Room 108 - Main Building, Floor 2, Capacity 30
- Amphitheater - Main Building, Floor 2, Capacity 35
- Network Laboratory - Science Building, Floor 2, Capacity 30

**Special Rooms:**
- Physics Laboratory - Science Building, Floor 2, Capacity 30
- Chemical Laboratory - Science Building, Floor 2, Capacity 30
- Kitchen - Home Economics Building, Floor 2, Capacity 15
- P.E. Hall - Sports Complex, Floor 1, Capacity 35

## Subjects Created ✓

**Special Subjects (requires_lab = true):**
- Physical Science - MAWD 12, 3 hours/week
- Chemical Science - MAWD 11, 3 hours/week
- Computer Programming 1 - MAWD 11, 3 hours/week
- Computer Programming 2 - MAWD 11, 3 hours/week
- Computer Programming 3 - MAWD 12, 3 hours/week
- Computer Programming 4 - MAWD 11, 3 hours/week
- Mobile Programming 1 - MAWD 11, 3 hours/week
- Mobile Programming 2 - MAWD 12, 3 hours/week
- Physical Education and Health 1 - ALL 11, 2 hours/week
- Physical Education and Health 2 - ALL 12, 2 hours/week
- General Chemistry 1 - STEM 11, 3 hours/week
- General Chemistry 2 - STEM 12, 3 hours/week
- General Physics 1 - STEM 11, 3 hours/week
- General Physics 2 - STEM 12, 3 hours/week

**Core Subjects (apply to ALL programs):**
- Media Information Literacy - ALL 11, 3 hours/week
- Understanding Culture, Society, and Politics - ALL 11, 3 hours/week
- Practical Research 1 - ALL 11, 3 hours/week
- Inquiries, Investigation, and Immersion - ALL 12, 3 hours/week
- Work Immersion - ALL 12, 2 hours/week
- Contemporary Philippine Arts from the Regions - ALL 12, 3 hours/week

**Specialized Subjects (program-specific):**
**MAWD:**
- Entrepreneurship - MAWD 12, 3 hours/week
- Statistics and Probability - MAWD 11, 3 hours/week
- Empowerment Technologies: ICT - MAWD 12, 3 hours/week

**ABM:**
- Accountancy & Business Management - ABM 11, 3 hours/week
- Business Ethics & Social Responsibility - ABM 12, 3 hours/week
- Basic Calculus - ABM 11, 3 hours/week
- Applied Economics - ABM 12, 3 hours/week
- Empowerment Technologies: ABM - ABM 12, 3 hours/week

**STEM:**
- Electronics - STEM 11, 3 hours/week
- Robotics - STEM 12, 3 hours/week
- Empowerment Technologies: STEM - STEM 12, 3 hours/week

## Sections Created ✓

- MAWD-11a - MAWD, Year 11, 30 students
- MAWD-12a - MAWD, Year 12, 30 students
- STEM-11a - STEM, Year 11, 30 students
- STEM-12a - STEM, Year 12, 30 students
- ABM-11a - ABM, Year 11, 30 students
- ABM-12a - ABM, Year 12, 30 students

## Teachers Created ✓

**Full-time Teachers:**
- Reneil P. Arnado - Business subjects (40 hours/week)
- Bea Angely Magno - Math subjects (40 hours/week)
- Ello Jr., Egnacio Y. - Research (40 hours/week)
- Edgar Habana - Arts & PE (40 hours/week)
- John Michael Calizon - Computer Science (40 hours/week)
- Psalmmiracle Pineda Mariano - Mobile Programming (40 hours/week)

**Part-time Teachers (Saturday only):**
- Mary Jane Balando - Physics (20 hours/week, Saturday only)
- Mark Gerald Doblon - Chemistry (20 hours/week, Saturday only)

**Teacher Preferences:**
- Part-time teachers have preferred_days set to ['Saturday']
- Part-time teachers have max_classes_per_day set to 4

## Notes

- All sections are for Senior High School
- College implementation will come later
- Room types in database: common, special
- Subject types in database: common, special
- Teachers created via Supabase Auth API using Node.js script
- All teachers assigned to appropriate subjects
- Subjects with program 'ALL' apply to all programs (MAWD, STEM, ABM)
- Refer to PRD for role-based access and other requirements
