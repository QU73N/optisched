// OptiSched - Create Demo Users via Supabase Admin API (ESM)
// Run: node --experimental-modules supabase/create_users.mjs <SERVICE_ROLE_KEY>

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xrcvngpvmauywlgcbbjo.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
    console.error('\n❌ Usage: node supabase/create_users.mjs <SERVICE_ROLE_KEY>');
    console.error('\n📋 Get your service_role key from:');
    console.error('   Supabase Dashboard > Settings > API > service_role (secret)\n');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const users = [
    { email: 'admin@optisched.sti.edu', password: 'Admin123!', role: 'admin', full_name: 'Dr. Admin User' },
    { email: 'teacher@optisched.sti.edu', password: 'Teacher123!', role: 'teacher', full_name: 'Bea Angely Magno' },
    { email: 'student@optisched.sti.edu', password: 'Student123!', role: 'student', full_name: 'Mark Angelo Cruz' },
];

console.log('\n🚀 Creating demo users...\n');

for (const user of users) {
    try {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === user.email);
        if (existing) {
            await supabase.auth.admin.deleteUser(existing.id);
            console.log(`🗑️  Deleted existing: ${user.email}`);
        }

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
        console.log(`✅ ${user.role.toUpperCase()}: ${user.email} / ${user.password}`);

        if (data.user) {
            await supabase.from('profiles').update({
                department: user.role === 'admin' ? 'Administration' : user.role === 'teacher' ? 'Computer Science' : null,
                program: user.role === 'student' ? 'BSIT' : null,
                year_level: user.role === 'student' ? 3 : null,
                section: user.role === 'student' ? 'BSIT 301-A' : null,
            }).eq('id', data.user.id);

            if (user.role === 'teacher') {
                await supabase.from('teachers').upsert({
                    profile_id: data.user.id,
                    department: 'Computer Science',
                    employment_type: 'full-time',
                    max_hours: 40,
                    current_load_percentage: 85,
                    is_active: true,
                }, { onConflict: 'profile_id' });
            }
        }
    } catch (err) {
        console.error(`❌ ${user.email}: ${err.message}`);
    }
}

console.log('\n✨ Done! Login credentials:');
console.log('Admin:   admin@optisched.sti.edu   / Admin123!');
console.log('Teacher: teacher@optisched.sti.edu / Teacher123!');
console.log('Student: student@optisched.sti.edu / Student123!\n');
