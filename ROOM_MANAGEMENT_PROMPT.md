# Room Management and Data Setup Prompt

## Room Management Rules

### Room Types
- **Common rooms:** Rooms wherein any subject can be taught. These are general-purpose classrooms without specialized equipment.
- **Special rooms:** Rooms that have equipment a specific subject needs (e.g., computer labs, science labs, studios, workshops). These are reserved preferentially for subjects that require them.
- **Hard constraint:** Special subjects (subjects with `requires_lab = true` or marked as requiring special equipment) can only be assigned to special rooms.
- **Soft constraint:** Special rooms are less likely to be used by common subjects (subjects that don't need special rooms). This maximizes room availability for subjects that actually require the specialized equipment.
- When conflicts exist, the scheduler prioritizes special subjects for special rooms, leaving common rooms available for general use.

### Room Constraints
- **Hard constraint:** Room capacity must always be greater than or equal to section size
- **Hard constraint:** Only one section may occupy a room during a given session

### Room Details
- Building
- Floor
- Room number
- Capacity
- These details are needed for soft constraint optimization (room movement and walking distance)

### Room Optimization
- **Soft optimization goal:** Attempt to minimize unnecessary movement between buildings and floors

## Rooms to Create

### Common Rooms
- Room 101, 102, 103, 104, 105, 106, 107, 108 - Capacity: 35
- Amphitheater - Capacity: 50

### Special Rooms
- Physics Laboratory - Capacity: 30
- Chemical Laboratory - Capacity: 30
- Kitchen - Capacity: 15
- P.E. Hall - Capacity: 20

## Subject-Room Assignments

**Special subjects (require special rooms):**
- Physical Science - all grade 12, special to physics lab
- Chemical Science - all grade 11, special to chemical lab
- Computer Programming 1 - all MAWD 11, special to computer lab
- Computer Programming 2 - all MAWD 11, special to computer lab
- Computer Programming 3 - all MAWD 12, special to computer lab
- Computer Programming 4 - all MAWD 11, special to computer lab
- Mobile Programming 1 - all mawd 11, special to computer lab
- Mobile Programming 2 - all mawd 12, special to computer lab
- Physical Education and Health 1 - all grade 11, special to pe hall
- Physical Education and Health 2 - all grade 12, special to pe hall
- General Chemistry 1 - All STEM 11, special to chem lab
- General Chemistry 2 - All STEM 12, special to chem lab
- General Physics 1 - All STEM 11, special to physics lab
- General Physics 2 - All STEM 12, special to physics lab

**Common subjects (can use any room, but special rooms only after special subjects):**
- Entrepreneurship - all grade 12, common
- Media Information Literacy - all grade 11, common
- Accountancy & Business Management - all ABM, common
- Business Ethics & Social Responsibility - all ABM 12, common
- Electronics - all STEM 11, common
- Robotics - all STEM 12, common
- Empowerment Technologies: ABM - all ABM 12, common
- Empowerment Technologies: ICT - all MAWD 12, common
- Empowerment Technologies: STEM - all STEM 12, common
- Applied Economics - All ABM 12, common
- Contemporary Philippine Arts from the Regions - all grade 12, common
- Understanding Culture, Society, and Politics - all grade 11, common
- Statistics and Probability - all grade 11, common
- Work Immersion - all grade 12, common
- Practical Research 1 - all grade 11, common
- Inquiries, Investigation, and Immersion - all grade 12, common
- Basic Calculus - All ABM 11, common

**Duration:** Everything requires 3 hours every week, except PE and immersion which is 2 hours.

## Teachers

### Full-time Teachers
- **Reneil P. Arnado** - Business subjects (full-time)
- **Bea Angely Magno** - Math subjects (full-time)
- **Ello Jr., Egnacio Y.** - Immersions, research (full-time)
- **Edgar Habana** - Contemporary arts and PE (full-time)
- **John Michael Calizon** - Computer programming and empowerment technologies (full-time)
- **Psalmmiracle Pineda Mariano** - Mobile programming (full-time)

### Part-time Teachers (Saturday only)
- **Mary Jane Balando** - Physics (part-time, Saturday only)
- **Mark Gerald Doblon** - Chemistry (part-time, Saturday only)

### Missing Teachers
If there are any missing teachers for subjects, create random teachers with password "teacher"

## Students
- Create 10 random students per section

## Sections (Senior High School Only)
- MAWD-11a
- MAWD-12a
- STEM-11a
- STEM-12a
- ABM-11a
- ABM-12a

Remove all other sections.

## Data Formatting
Ensure all data formatting is consistent across all tables.
