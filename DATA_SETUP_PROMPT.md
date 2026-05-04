# Data Setup Prompt

## Room Management

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

**Common Rooms:**
- Room 101, 102, 103, 104, 105, 106, 107, 108
- Amphitheater
- Capacity: 30 or 35 (except Amphitheater can be larger)

**Special Rooms:**
- Physics Laboratory - Special
- Chemical Laboratory - Special
- Kitchen - Special
- P.E. Hall - Special
- Capacity: Kitchen (15), P.E. Hall (20), others (30 or 35)

## Subjects Configuration

**Key Rule:** Special rooms can still be used by common subjects, but only after all special subjects to that room are already set (special subjects have higher priority)

**Subject Details:**

1. **Physical Science** - All grade 12, special to physics lab, 3 hours/week
2. **Chemical Science** - All grade 11, special to chemical lab, 3 hours/week
3. **Computer Programming 1** - All MAWD 11, special to computer lab, 3 hours/week
4. **Computer Programming 2** - All MAWD 11, special to computer lab, 3 hours/week
5. **Computer Programming 3** - All MAWD 12, special to computer lab, 3 hours/week
6. **Computer Programming 4** - All MAWD 11, special to computer lab, 3 hours/week
7. **Mobile Programming 1** - All MAWD 11, special to computer lab, 3 hours/week
8. **Mobile Programming 2** - All MAWD 12, special to computer lab, 3 hours/week
9. **Entrepreneurship** - All grade 12, common, 3 hours/week
10. **Media Information Literacy** - All grade 11, common, 3 hours/week
11. **Accountancy & Business Management** - All ABM, common, 3 hours/week
12. **Business Ethics & Social Responsibility** - All ABM 12, common, 3 hours/week
13. **Physical Education and Health 1** - All grade 11, special to PE hall, 2 hours/week
14. **Physical Education and Health 2** - All grade 12, special to PE hall, 2 hours/week
15. **Electronics** - All STEM 11, common, 3 hours/week
16. **Robotics** - All STEM 12, common, 3 hours/week
17. **Empowerment Technologies: ABM** - All ABM 12, common, 3 hours/week
18. **Empowerment Technologies: ICT** - All MAWD 12, common, 3 hours/week
19. **Empowerment Technologies: STEM** - All STEM 12, common, 3 hours/week
20. **Applied Economics** - All ABM 12, common, 3 hours/week
21. **General Chemistry 1** - All STEM 11, special to chem lab, 3 hours/week
22. **General Chemistry 2** - All STEM 12, special to chem lab, 3 hours/week
23. **General Physics 1** - All STEM 11, special to chem lab, 3 hours/week
24. **General Physics 2** - All STEM 12, special to chem lab, 3 hours/week
25. **Contemporary Philippine Arts from the Regions** - All grade 12, common, 3 hours/week
26. **Understanding Culture, Society, and Politics** - All grade 11, common, 3 hours/week
27. **Statistics and Probability** - All grade 11, common, 3 hours/week
28. **Work Immersion** - All grade 12, common, 2 hours/week
29. **Practical Research 1** - All grade 11, common, 3 hours/week
30. **Inquiries, Investigation, and Immersion** - All grade 12, common, 3 hours/week
31. **Basic Calculus** - All ABM 11, common, 3 hours/week

## Teachers Configuration

**Full-time Teachers:**
1. **Reneil P. Arnado** - Can do anything related to business
2. **Bea Angely Magno** - Can do math
3. **Ello Jr., Egnacio Y.** - Can handle immersions, research
4. **Edgar Habana** - Contemporary arts and PE
5. **John Michael Calizon** - Computer programming and empowerment technologies
6. **Psalmmiracle Pineda Mariano** - Mobile programming

**Part-time Teachers:**
1. **Mary Jane Balando** - Physics, part-time, Saturday only
2. **Mark Gerald Doblon** - Chemistry, part-time, Saturday

**Missing Teachers:** Create random teachers for any subjects without assigned teachers, password "teacher"

## Sections

Only these sections should exist:
- MAWD-11a
- MAWD-12a
- STEM-11a
- STEM-12a
- ABM-11a
- ABM-12a

Remove all other sections.

## Students

Create 10 random students per section.

## Notes

- All subjects require 3 hours per week, except PE and Work Immersion which require 2 hours
- Sections are for senior high school (college to be implemented later)
- Ensure data formatting is consistent
