import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
    throw new Error(
        'Missing Supabase environment variables. Please check that VITE_SUPABASE_URL and VITE_SUPABASE_KEY are set in your .env file.'
    );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 50,
        },
    },
});
