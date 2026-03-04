// OptiSched - Create ALL users (demo + instructors) via Supabase Admin API
// Run: node supabase/create_all_users.mjs <SERVICE_ROLE_KEY>

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xrcvngpvmauywlgcbbjo.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
    console.error('\n❌ Usage: node supabase/create_all_users.mjs <SERVICE_ROLE_KEY>\n');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
    // Demo users
    { email: 'admin@optisched.sti.edu', password: 'Admin123!', role: 'admin', full_name: 'Dr. Admin User', dept: 'Administration' },
    { email: 'student@optisched.sti.edu', password: 'Student123!', role: 'student', full_name: 'Mark Angelo Cruz', dept: null, program: 'MAWD', year_level: 12, section: 'MAWD 12A-2' },
    // Real instructors
    { email: 'habana@optisched.sti.edu', password: 'Teacher123!', role: 'teacher', full_name: 'Habana Jr., Edgar P.', dept: 'General Education' },
    { email: 'calizon@optisched.sti.edu', password: 'Teacher123!', role: 'teacher', full_name: 'Calizon, John Michael', dept: 'Computer Science' },
    { email: 'mariano@optisched.sti.edu', password: 'Teacher123!', role: 'teacher', full_name: 'Mariano, Psalmmiracle Pineda', dept: 'Computer Science' },
    { email: 'magno@optisched.sti.edu', password: 'Teacher123!', role: 'teacher', full_name: 'Magno, Bea Angely', dept: 'Research' },
    { email: 'ello@optisched.sti.edu', password: 'Teacher123!', role: 'teacher', full_name: 'Ello Jr., Egnacio Y.', dept: 'Practicum' },
    { email: 'arnado@optisched.sti.edu', password: 'Teacher123!', role: 'teacher', full_name: 'Arnado, Reniel P.', dept: 'Business' },
];

console.log('\n🚀 Creating all users...\n');

for (const user of users) {
    try {
        // Delete existing
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === user.email);
        if (existing) {
            await supabase.auth.admin.deleteUser(existing.id);
            console.log(`🗑️  Deleted existing: ${user.email}`);
        }

        // Create user
        const { data, error } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { role: user.role, full_name: user.full_name },
        });

        if (error) {
            console.error(`❌ ${user.email}: ${error.message}`);
            continue;
        }
        console.log(`✅ ${user.role.toUpperCase().padEnd(7)} ${user.full_name.padEnd(32)} (${user.email})`);

        if (data.user) {
            // Update profile
            await supabase.from('profiles').update({
                department: user.dept,
                program: user.program || null,
                year_level: user.year_level || null,
                section: user.section || null,
            }).eq('id', data.user.id);

            // Create teacher record for teachers
            if (user.role === 'teacher') {
                const { data: teacherData } = await supabase.from('teachers').upsert({
                    profile_id: data.user.id,
                    department: user.dept || 'General',
                    employment_type: 'full-time',
                    max_hours: 40,
                    current_load_percentage: 0,
                    is_active: true,
                }, { onConflict: 'profile_id' }).select().single();

                if (teacherData) {
                    // Create preferences
                    await supabase.from('teacher_preferences').upsert({
                        teacher_id: teacherData.id,
                        preferred_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                        morning_available: true,
                        afternoon_available: true,
                        evening_available: false,
                        max_consecutive_hours: 4,
                    }, { onConflict: 'teacher_id' });
                }
            }
        }
    } catch (err) {
        console.error(`❌ ${user.email}: ${err.message}`);
    }
}

// Now create schedule entries
console.log('\n📅 Creating schedule entries...\n');

// Get all IDs we need
const { data: allTeachers } = await supabase.from('teachers').select('id, profile:profiles(email, full_name)');
const { data: allSubjects } = await supabase.from('subjects').select('*');
const { data: allRooms } = await supabase.from('rooms').select('*');
const { data: allSections } = await supabase.from('sections').select('*');

const findTeacher = (name) => allTeachers?.find(t => t.profile?.full_name?.includes(name))?.id;
const findSubject = (code) => allSubjects?.find(s => s.code === code)?.id;
const findRoom = (name) => allRooms?.find(r => r.name === name)?.id;
const findSection = (name) => allSections?.find(s => s.name === name)?.id;

const sectionId = findSection('MAWD 12A-2');

const scheduleEntries = [
    { subjectCode: 'PEH4', teacherName: 'Habana', day: 'Monday', start: '07:00', end: '09:00', room: 'PEH001' },
    { subjectCode: 'CWPNC3', teacherName: 'Calizon', day: 'Monday', start: '10:00', end: '13:00', room: 'COM001' },
    { subjectCode: 'MAP2', teacherName: 'Mariano', day: 'Monday', start: '13:00', end: '16:00', room: 'COM001' },
    { subjectCode: 'CPAR', teacherName: 'Habana', day: 'Tuesday', start: '10:00', end: '13:00', room: 'RM102' },
    { subjectCode: 'HR', teacherName: 'Habana', day: 'Tuesday', start: '13:00', end: '14:00', room: 'RM102' },
    { subjectCode: 'WIP', teacherName: 'Ello', day: 'Tuesday', start: '14:00', end: '17:00', room: 'RM102' },
    { subjectCode: 'III', teacherName: 'Magno', day: 'Tuesday', start: '08:30', end: '10:00', room: 'RM102' },
    { subjectCode: 'III', teacherName: 'Magno', day: 'Thursday', start: '08:30', end: '10:00', room: 'RM102' },
    { subjectCode: 'ETICT', teacherName: 'Calizon', day: 'Thursday', start: '10:00', end: '13:00', room: 'COM001' },
    { subjectCode: 'ENTREP', teacherName: 'Arnado', day: 'Thursday', start: '14:30', end: '17:30', room: 'RM101' },
];

// Clear old schedule entries for this section
if (sectionId) {
    await supabase.from('schedules').delete().eq('section_id', sectionId);
}

let successCount = 0;
for (const entry of scheduleEntries) {
    const subjectId = findSubject(entry.subjectCode);
    const teacherId = findTeacher(entry.teacherName);
    const roomId = findRoom(entry.room);

    if (!subjectId || !teacherId || !roomId || !sectionId) {
        console.error(`⚠️  Missing ref for ${entry.subjectCode}: subject=${!!subjectId} teacher=${!!teacherId} room=${!!roomId} section=${!!sectionId}`);
        continue;
    }

    const { error } = await supabase.from('schedules').insert({
        subject_id: subjectId,
        teacher_id: teacherId,
        room_id: roomId,
        section_id: sectionId,
        day_of_week: entry.day,
        start_time: entry.start,
        end_time: entry.end,
        semester: '2nd Semester',
        academic_year: '2025-2026',
        status: 'published',
    });

    if (error) {
        console.error(`❌ ${entry.subjectCode} ${entry.day}: ${error.message}`);
    } else {
        successCount++;
        console.log(`✅ ${entry.day.padEnd(9)} ${entry.start}-${entry.end}  ${entry.subjectCode}`);
    }
}

// Update teacher load percentages
for (const teacher of (allTeachers || [])) {
    const { count } = await supabase.from('schedules').select('*', { count: 'exact', head: true }).eq('teacher_id', teacher.id);
    const hoursPerWeek = (count || 0) * 2; // rough estimate
    const loadPct = Math.min(Math.round((hoursPerWeek / 40) * 100), 100);
    await supabase.from('teachers').update({ current_load_percentage: loadPct }).eq('id', teacher.id);
}

console.log(`\n✨ Done! Created ${successCount}/${scheduleEntries.length} schedule entries.`);
console.log('\n📋 Login credentials (all passwords: Teacher123!):');
console.log('┌──────────────────────────────────┬───────────────────────────────┐');
console.log('│ Name                             │ Email                         │');
console.log('├──────────────────────────────────┼───────────────────────────────┤');
console.log('│ Dr. Admin User                   │ admin@optisched.sti.edu       │');
console.log('│ Mark Angelo Cruz (Student)       │ student@optisched.sti.edu     │');
console.log('│ Habana Jr., Edgar P.             │ habana@optisched.sti.edu      │');
console.log('│ Calizon, John Michael            │ calizon@optisched.sti.edu     │');
console.log('│ Mariano, Psalmmiracle Pineda     │ mariano@optisched.sti.edu     │');
console.log('│ Magno, Bea Angely                │ magno@optisched.sti.edu       │');
console.log('│ Ello Jr., Egnacio Y.             │ ello@optisched.sti.edu        │');
console.log('│ Arnado, Reniel P.                │ arnado@optisched.sti.edu      │');
console.log('└──────────────────────────────────┴───────────────────────────────┘');
