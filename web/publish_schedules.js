import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_KEY;

// Use anon key + sign in as admin so auth.uid() is set for triggers
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function publishSchedules() {
  // Step 1: Sign in as admin to set auth.uid()
  console.log("Signing in as admin...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'admin@optisched.sti.edu',
    password: 'Adminako'
  });

  if (authErr) {
    console.error("Auth failed:", authErr.message);
    return;
  }
  console.log(`Signed in as: ${authData.user.email} (${authData.user.id})`);

  // Step 2: Get all draft schedules
  const { data: drafts, error: draftErr } = await supabase
    .from('schedules')
    .select('id, day_of_week, status, section_id')
    .eq('status', 'draft');

  if (draftErr) {
    console.error("Error fetching drafts:", draftErr);
    return;
  }
  console.log(`Found ${drafts.length} draft schedules to publish`);

  // Step 3: Publish them one by one
  let published = 0;
  let failed = 0;
  for (const sched of drafts) {
    const { error } = await supabase
      .from('schedules')
      .update({ 
        status: 'published',
        approved_by: authData.user.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', sched.id);

    if (error) {
      console.error(`Failed ${sched.id}:`, error.message);
      failed++;
    } else {
      published++;
    }
  }

  console.log(`\nDone: ${published} published, ${failed} failed`);

  // Step 4: Verify MAWD-12a
  const { data: verify } = await supabase
    .from('schedules')
    .select('status')
    .eq('section_id', '35395658-0c3d-4bf5-9068-542cacc58de5');
  
  const counts = {};
  verify?.forEach(s => { counts[s.status] = (counts[s.status] || 0) + 1; });
  console.log('MAWD-12a schedule statuses:', counts);

  await supabase.auth.signOut();
}

publishSchedules();
