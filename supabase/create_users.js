// OptiSched - Create Demo Users via Supabase Admin API
// Run: node supabase/create_users.js

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xrcvngpvmauywlgcbbjo.supabase.co';
// You need the SERVICE ROLE key (not anon key) for admin operations
// Get it from: Supabase Dashboard > Settings > API > service_role key
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
    console.error('\n❌ Usage: node supabase/create_users.js <SERVICE_ROLE_KEY>');
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

async function createUsers() {
    console.log('\n🚀 Creating demo users...\n');

    for (const user of users) {
        // Delete existing user with same email (if exists)
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === user.email);
        if (existing) {
            await supabase.auth.admin.deleteUser(existing.id);
            console.log(`🗑️  Deleted existing user: ${user.email}`);
        }

        // Create user via Admin API (proper password hashing)
        const { data, error } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.password,
            email_confirm: true,
            user_metadata: { role: user.role, full_name: user.full_name },
        });

        if (error) {
            console.error(`❌ Failed to create ${user.email}:`, error.message);
            continue;
        }

        console.log(`✅ Created ${user.role.toUpperCase()}: ${user.email} / ${user.password}`);

        // Update profile with extra data
        if (data.user) {
            const profileUpdate = {
                department: user.role === 'admin' ? 'Administration' : user.role === 'teacher' ? 'Computer Science' : null,
                program: user.role === 'student' ? 'BSIT' : null,
                year_level: user.role === 'student' ? 3 : null,
                section: user.role === 'student' ? 'BSIT 301-A' : null,
            };
            await supabase.from('profiles').update(profileUpdate).eq('id', data.user.id);

            // Create teacher record if teacher role
            if (user.role === 'teacher') {
                await supabase.from('teachers').upsert({
                    profile_id: data.user.id,
                    department: 'Computer Science',
                    employment_type: 'full-time',
                    max_hours: 40,
                    current_load_percentage: 85,
                    is_active: true,
                }, { onConflict: 'profile_id' });
                console.log(`   📚 Created teacher record for ${user.full_name}`);
            }
        }
    }

    console.log('\n✨ Done! You can now login with these credentials.\n');
    console.log('┌──────────┬───────────────────────────────┬─────────────┐');
    console.log('│ Role     │ Email                         │ Password    │');
    console.log('├──────────┼───────────────────────────────┼─────────────┤');
    console.log('│ Admin    │ admin@optisched.sti.edu        │ Admin123!   │');
    console.log('│ Teacher  │ teacher@optisched.sti.edu      │ Teacher123! │');
    console.log('│ Student  │ student@optisched.sti.edu      │ Student123! │');
    console.log('└──────────┴───────────────────────────────┴─────────────┘');
}

createUsers().catch(console.error);
