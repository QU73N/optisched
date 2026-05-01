import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, 'sb_secret_dLrEn6OjdCDzi_BYWaumdg_b1Axhu6F');

async function verify() {
  // Get all schedules grouped by section and status
  const { data } = await supabase
    .from('schedules')
    .select('status, section:sections(name)');

  const sections = {};
  data?.forEach(s => {
    const name = s.section?.name || 'unknown';
    if (!sections[name]) sections[name] = { published: 0, draft: 0, other: 0 };
    if (s.status === 'published') sections[name].published++;
    else if (s.status === 'draft') sections[name].draft++;
    else sections[name].other++;
  });

  console.log(`Total schedules: ${data?.length}`);
  console.log('\nSchedules per section:');
  Object.entries(sections).sort().forEach(([name, counts]) => {
    console.log(`  ${name}: ${counts.published} published, ${counts.draft} draft, ${counts.other} other`);
  });

  const totalDraft = data?.filter(s => s.status === 'draft').length || 0;
  console.log(`\nRemaining drafts: ${totalDraft}`);
}

verify();
