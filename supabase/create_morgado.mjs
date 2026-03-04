// Create morgado user account
// Run: node supabase/create_morgado.mjs "YOUR_SERVICE_ROLE_KEY"

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xrcvngpvmauywlgcbbjo.supabase.co';
const SERVICE_ROLE_KEY = process.argv[2];

if (!SERVICE_ROLE_KEY) {
    console.error('Usage: node supabase/create_morgado.mjs "YOUR_SERVICE_ROLE_KEY"');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function createMorgado() {
    console.log('🚀 Creating Morgado user...\n');

    // Check if already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === 'morgado@optisched.sti.edu');
    if (existing) {
        await supabase.auth.admin.deleteUser(existing.id);
        console.log('🗑️  Deleted existing morgado account');
    }

    // Create user
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'morgado@optisched.sti.edu',
        password: 'Teacher123!',
        email_confirm: true,
        user_metadata: { role: 'student', full_name: 'Morgado' },
    });

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    // Update profile
    if (data.user) {
        await supabase.from('profiles').upsert({
            id: data.user.id,
            email: 'morgado@optisched.sti.edu',
            role: 'student',
            full_name: 'Morgado',
            program: 'MAWD',
            section: 'MAWD 12A-2',
            year_level: 12,
            department: 'Information Technology',
        });

        console.log('✅ Created: morgado@optisched.sti.edu / Teacher123!');
        console.log('   Role: Student | Strand: MAWD | Section: MAWD 12A-2');
    }

    console.log('\n✨ Done!');
}

createMorgado().catch(console.error);
