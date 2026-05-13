import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnoseSchedules() {
    console.log('=== SCHEDULE VISIBILITY DIAGNOSTICS ===\n');

    // 1. Check schedules by status and is_active
    console.log('1. SCHEDULES BY STATUS AND IS_ACTIVE');
    const { data: schedulesByStatus, error: statusError } = await supabase
        .from('schedules')
        .select('status, is_active')
        .order('status', { ascending: true });
    
    if (statusError) {
        console.error('Error fetching schedules by status:', statusError);
    } else {
        const grouped = schedulesByStatus.reduce((acc: any, s: any) => {
            const key = `${s.status}_${s.is_active}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        console.log('Count by status and is_active:', grouped);
    }

    // 2. Check for duplicate schedules
    console.log('\n2. POTENTIAL DUPLICATES (same section, day, time, subject)');
    const { data: duplicates, error: dupError } = await supabase
        .from('schedules')
        .select('section_id, day_of_week, start_time, end_time, subject_id, status, is_active')
        .eq('status', 'published');
    
    if (dupError) {
        console.error('Error checking duplicates:', dupError);
    } else {
        const slotMap = new Map();
        duplicates.forEach((s: any) => {
            const key = `${s.section_id}_${s.day_of_week}_${s.start_time}_${s.end_time}_${s.subject_id}`;
            if (!slotMap.has(key)) {
                slotMap.set(key, []);
            }
            slotMap.get(key).push(s);
        });

        let dupCount = 0;
        slotMap.forEach((schedules: any[], key: string) => {
            if (schedules.length > 1) {
                dupCount++;
                console.log(`Slot ${key}: ${schedules.length} schedules`);
                schedules.forEach((s: any) => {
                    console.log(`  - ID: ${s.id}, is_active: ${s.is_active}`);
                });
            }
        });
        console.log(`Total duplicate slots: ${dupCount}`);
    }

    // 3. Check inactive published schedules
    console.log('\n3. INACTIVE PUBLISHED SCHEDULES');
    const { data: inactivePublished, error: inactiveError } = await supabase
        .from('schedules')
        .select('id, section_id, day_of_week, start_time, subject_id, is_active, updated_at')
        .eq('status', 'published')
        .eq('is_active', false)
        .limit(10);
    
    if (inactiveError) {
        console.error('Error fetching inactive published:', inactiveError);
    } else {
        console.log(`Inactive published schedules (first 10): ${inactivePublished.length}`);
        inactivePublished.forEach((s: any) => {
            console.log(`  - ${s.id}, section: ${s.section_id}, day: ${s.day_of_week}, time: ${s.start_time}`);
        });
    }

    // 4. Check active published schedules
    console.log('\n4. ACTIVE PUBLISHED SCHEDULES');
    const { data: activePublished, error: activeError } = await supabase
        .from('schedules')
        .select('id, section_id, day_of_week, start_time, subject_id, is_active')
        .eq('status', 'published')
        .eq('is_active', true);
    
    if (activeError) {
        console.error('Error fetching active published:', activeError);
    } else {
        console.log(`Active published schedules: ${activePublished.length}`);
    }

    // 5. Check student's section
    console.log('\n5. STUDENT SECTION INFO');
    // You'll need to provide the student's profile ID
    const studentProfileId = 'YOUR_STUDENT_PROFILE_ID'; // Replace with actual ID
    const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('section_id, sections(name)')
        .eq('profile_id', studentProfileId)
        .single();
    
    if (studentError) {
        console.error('Error fetching student section:', studentError);
    } else {
        console.log('Student section:', studentData);
    }

    console.log('\n=== DIAGNOSTICS COMPLETE ===');
}

diagnoseSchedules().catch(console.error);
