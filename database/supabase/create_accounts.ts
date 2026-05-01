// Create missing admin and student accounts
// Run with: npx tsx database/supabase/create_accounts.ts

import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase project settings
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DEFAULT_PASSWORD = 'OptiSched2024!';

const usersToCreate = [
  // Admin roles
  {
    email: 'power.admin@optisched.sti.edu',
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Power Admin',
      role: 'power_admin'
    }
  },
  {
    email: 'system.admin@optisched.sti.edu',
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'System Admin',
      role: 'system_admin'
    }
  },
  {
    email: 'schedule.admin@optisched.sti.edu',
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Schedule Admin',
      role: 'schedule_admin'
    }
  },
  {
    email: 'schedule.manager@optisched.sti.edu',
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'Schedule Manager',
      role: 'schedule_manager'
    }
  },
  // Students
  {
    email: 'mawd11.student@optisched.sti.edu',
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'MAWD11 Student',
      role: 'student'
    }
  },
  {
    email: 'abm12.student@optisched.sti.edu',
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'ABM12 Student',
      role: 'student'
    }
  },
  {
    email: 'stem12.student@optisched.sti.edu',
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: 'STEM12 Student',
      role: 'student'
    }
  }
];

async function createUsers() {
  console.log('Creating auth users...');
  
  for (const user of usersToCreate) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: user.email_confirm,
        user_metadata: user.user_metadata
      });
      
      if (error) {
        console.error(`Error creating user ${user.email}:`, error.message);
      } else {
        console.log(`✓ Created user: ${user.email} (ID: ${data.user.id})`);
        
        // Create profile record
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: user.email,
            full_name: user.user_metadata.full_name,
            role: user.user_metadata.role
          });
        
        if (profileError) {
          console.error(`Error creating profile for ${user.email}:`, profileError.message);
        } else {
          console.log(`✓ Created profile for: ${user.email}`);
        }
      }
    } catch (err) {
      console.error(`Error creating user ${user.email}:`, err);
    }
  }
  
  console.log('\nCreating student records...');
  
  // Get section IDs
  const { data: sections } = await supabase
    .from('sections')
    .select('id, name')
    .in('name', ['MAWD-11a', 'ABM-12a', 'STEM-12a']);
  
  const sectionMap = new Map(sections?.map(s => [s.name, s.id]) || []);
  
  // Get student profile IDs
  const { data: studentProfiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', ['mawd11.student@optisched.sti.edu', 'abm12.student@optisched.sti.edu', 'stem12.student@optisched.sti.edu']);
  
  const profileMap = new Map(studentProfiles?.map(p => [p.email, p.id]) || []);
  
  // Create student records
  const studentAssignments = [
    { email: 'mawd11.student@optisched.sti.edu', section: 'MAWD-11a', studentNumber: 'MAWD11-001' },
    { email: 'abm12.student@optisched.sti.edu', section: 'ABM-12a', studentNumber: 'ABM12-001' },
    { email: 'stem12.student@optisched.sti.edu', section: 'STEM-12a', studentNumber: 'STEM12-001' }
  ];
  
  for (const assignment of studentAssignments) {
    const profileId = profileMap.get(assignment.email);
    const sectionId = sectionMap.get(assignment.section);
    
    if (profileId && sectionId) {
      const { error } = await supabase
        .from('students')
        .insert({
          profile_id: profileId,
          section_id: sectionId,
          student_number: assignment.studentNumber,
          is_active: true
        });
      
      if (error) {
        console.error(`Error creating student record for ${assignment.email}:`, error.message);
      } else {
        console.log(`✓ Created student record for: ${assignment.email} in ${assignment.section}`);
      }
    } else {
      console.error(`Missing profile or section for ${assignment.email}`);
    }
  }
  
  console.log('\n✅ Account creation complete!');
}

createUsers().catch(console.error);
